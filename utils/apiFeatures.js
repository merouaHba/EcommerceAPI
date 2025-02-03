const CustomError = require('../errors');

class APIFeatures {
    constructor(req, model, options = {}) {
        this.req = req;
        this.model = model;
        this.pathMappings = options.pathMappings || {};
        // Configure lookup settings for populated fields
        this.lookupConfig = options.lookupConfig || {
            // Default format:
            // fieldPath: { from: 'collectionName', localField: 'fieldName', foreignField: '_id' }
            // Example:
            // 'category.name': { from: 'categories', localField: 'category', foreignField: '_id' }
        };

        this.config = {
            pagination: {
                defaultLimit: options.pagination?.defaultLimit || 25,
                maxLimit: options.pagination?.maxLimit || 100,
                maxSkip: options.pagination?.maxSkip || 10000
            },

            fields: {
                // Fields that can be searched
                searchable: options.searchable || ['name', 'description'],

                // Fields that can be used for sorting
                sortable: options.sortable || ['createdAt', 'updatedAt'],

                // Fields that can be selected
                selectable: options.selectable || ['*'], // '*' means all fields

                // Fields that should be excluded by default
                excluded: options.excluded || ['password', '__v'],

                // Fields that must always be selected
                required: options.required || ['_id'],
            },

            // Search configuration
            search: {
                useTextIndex: options.useTextIndex || false,
                fuzzySearch: options.fuzzySearch || false,
                caseSensitive: options.caseSensitive || false
            },

            // Filter configuration
            filters: {
                // Allowed filter operations for each field
                allowed: options.filters || {
                    createdAt: ['gt', 'gte', 'lt', 'lte'],
                    updatedAt: ['gt', 'gte', 'lt', 'lte'],
                }
            },

            // Population configuration
            population: {
                default: options?.population?.default || [],
                maxDepth: options?.population?.maxDepth || 2
            }
        };

        this.query = null;
        this.queryObj = {};
        this.isAggregation = false;
    }

    async execute() {
        try {
            this.buildQuery()
            .handlePopulation()
            .handleSearch()
                .handleSelect()
                .handleSort()
                .handlePagination();

            return this.executeQuery();
        } catch (error) {
            throw new CustomError.BadRequestError(`Query execution failed: ${error.message}`);
        }
    }

    async executeQuery() {
        try {
            // Add timeout to prevent long-running queries
            if (!this.isAggregation) {
                this.query = this.query.maxTimeMS(5000);
            }else{
                // console.log(this.query.pipeline())
            }
            const results = await this.query;

            // Get total count
            let total;
            if (this.isAggregation) {
               
                // For aggregation, we need to run a separate count pipeline
                const countPipeline = this.query.pipeline()
                    .filter(stage => !stage.$skip && !stage.$limit); // Remove pagination stages

                const countResult = await this.model.aggregate([
                    ...countPipeline,
                    { $count: 'total' }
                ]);
                total = countResult[0]?.total || 0;
            } else {
                total = await this.model.countDocuments(this.queryObj).maxTimeMS(5000);
            }

            const limit = Math.min(
                parseInt(this.req.query.limit) || this.config.pagination.defaultLimit,
                this.config.pagination.maxLimit
            );

            return {
                success: true,
                count: results.length,
                total,
                pages: !this.req.query.cursor ?
                    Math.ceil(total / limit) :
                    undefined,
                currentPage: !this.req.query.cursor ?
                    parseInt(this.req.query.page) || 1 :
                    undefined,
                data: results
            };
        } catch (error) {
            console.error('Query execution error:', error);
            throw new CustomError.BadRequestError(
                `Query execution failed: ${error.message}`
            );
        }
    }

    buildQuery() {
        try {
            const reqQuery = this.sanitizeQueryParams({ ...this.req.query });
            const removeFields = ['select', 'sort', 'page', 'limit', 'filter', 'search', 'cursor'];
            removeFields.forEach(param => delete reqQuery[param]);
            delete reqQuery._id;

            const baseQuery = {};
            const pipeline = [];
            const processedLookups = new Set();

            // Process each query parameter
            for (const [field, value] of Object.entries(reqQuery)) {
                const actualField = this.pathMappings[field] || field;

                // Check if this field needs a lookup
                const lookupNeeded = Object.keys(this.lookupConfig)
                    .find(pattern => actualField.startsWith(pattern));

                if (lookupNeeded && !processedLookups.has(lookupNeeded)) {
                    // Handle lookup field
                    const lookupSettings = this.lookupConfig[lookupNeeded];
                    const lookupAlias = `_${lookupSettings.localField}`;

                    // Add lookup stage
                    pipeline.push({
                        $lookup: {
                            from: lookupSettings.from,
                            localField: lookupSettings.localField,
                            foreignField: lookupSettings.foreignField,
                            as: lookupAlias
                        }
                    });

                    // Add match stage for the lookup field
                    const fieldPath = actualField.split('.').slice(1).join('.');
                    const matchValue = this.parseQueryValue(value);

                    pipeline.push({
                        $match: {
                            [`${lookupAlias}.${fieldPath}`]: matchValue
                        }
                    });

                    processedLookups.add(lookupNeeded);
                } else if (!lookupNeeded) {
                    // Handle regular field
                    baseQuery[actualField] = this.parseQueryValue(value);
                }
            }

            // Add remaining filters to pipeline if any exist
            if (Object.keys(baseQuery).length > 0) {
                pipeline.push({ $match: baseQuery });
            }

            // Clean up lookup fields if we used any
            if (processedLookups.size > 0) {
                const projectStage = { $project: {} };
                processedLookups.forEach(lookup => {
                    const lookupSettings = this.lookupConfig[lookup];
                    projectStage.$project[`_${lookupSettings.localField}`] = 0;
                });
                pipeline.push(projectStage);
            }

            // Determine whether to use aggregation or find
            if (pipeline.length > 0) {
                this.query = this.model.aggregate(pipeline);
                this.isAggregation = true;
            } else {
                this.query = this.model.find(baseQuery);
                this.isAggregation = false;
            }

            this.queryObj = baseQuery;

            return this;
        } catch (error) {
            throw new CustomError.BadRequestError(`Query building failed: ${error.message}`);
        }
    }

    parseQueryValue(value) {
        if (typeof value === 'string' && value.includes(',')) {
            return { $in: value.split(',').map(v => this.parseValue(v.trim())) };
        }

        if (typeof value === 'object' && value !== null) {
            const parsedValue = {};
            for (const [operator, operatorValue] of Object.entries(value)) {
                const mongoOperator = operator.startsWith('$') ? operator : `$${operator}`;
                parsedValue[mongoOperator] = this.parseValue(operatorValue);
            }
            return parsedValue;
        }

        return this.parseValue(value);
    }

    parseValue(value) {
        // Handle arrays (for $in operator)
        if (Array.isArray(value)) {
            return value.map(item => this.parseValue(item));
        }

        // Handle numeric strings
        if (typeof value === 'string' && !isNaN(value) && value.trim() !== '') {
            return Number(value);
        }

        // Handle comma-separated strings
        if (typeof value === 'string' && value.includes(',')) {
            return value.split(',').map(v => this.parseValue(v.trim()));
        }

        // Handle boolean strings
        if (value === 'true' || value === 'false') {
            return value === 'true';
        }

        // Handle date strings
        if (typeof value === 'string' && Date.parse(value)) {
            return new Date(value);
        }

        return value;
    }

    handleSearch() {
        if (this.req.query.search) {
            const searchTerm = this.sanitizeString(this.req.query.search);
            const searchFields = this.config.fields.searchable;

            if (this.config.search.useTextIndex) {
                if (this.isAggregation) {
                    this.query.pipeline().push({
                        $match: {
                            $text: {
                                $search: searchTerm,
                                $caseSensitive: this.config.search.caseSensitive
                            }
                        }
                    });
                } else {
                    this.queryObj.$text = {
                        $search: searchTerm,
                        $caseSensitive: this.config.search.caseSensitive
                    };
                    this.query = this.model.find(this.queryObj);
                }
            } else {
                const searchConditions = searchFields.map(field => ({
                    [field]: {
                        $regex: this.config.search.fuzzySearch ?
                            new RegExp(searchTerm.split('').join('.*'), 'i') :
                            new RegExp(searchTerm, this.config.search.caseSensitive ? '' : 'i')
                    }
                }));

                if (this.isAggregation) {
                    this.query.pipeline().push({
                        $match: { $or: searchConditions }
                    });
                } else {
                    this.queryObj.$or = searchConditions;
                    this.query = this.model.find(this.queryObj);
                }
            }
        }
        return this;
    }

    handleSelect() {
        let fields = new Set(this.config.fields.required);

        if (this.req.query.select) {
            const requestedFields = this.sanitizeString(this.req.query.select)
                .split(',')
                .map(field => field.trim())
                .filter(field => this.isValidFieldName(field));

            if (this.config.fields.selectable.includes('*')) {
                requestedFields.forEach(field => fields.add(field));
            } else {
                requestedFields
                    .filter(field => this.config.fields.selectable.includes(field))
                    .forEach(field => fields.add(field));
            }
        } else {
            if (this.config.fields.selectable.includes('*')) {
                const modelFields = Object.keys(this.model.schema.paths);
                modelFields
                    .filter(field => !this.config.fields.excluded.includes(field))
                    .forEach(field => fields.add(field));
            } else {
                this.config.fields.selectable.forEach(field => fields.add(field));
            }
        }

        // Remove excluded fields
        this.config.fields.excluded.forEach(field => fields.delete(field));

        // Convert fields Set to an object for projection
        const fieldProjection = {};
        fields.forEach(field => {
            if (field.includes('.')) {
                // Handle nested fields (e.g., subcategories.name)
                const [parentField, childField] = field.split('.');
                if (!fieldProjection[parentField]) {
                    fieldProjection[parentField] = {};
                }
                fieldProjection[parentField][childField] = 1;
            } else {
                fieldProjection[field] = 1;
            }
        });

        if (this.isAggregation) {
            // For aggregation, add a $project stage
            this.query.pipeline().push({
                $project: fieldProjection
            });
        } else {
            // For regular queries, use select
            this.query = this.query.select(Array.from(fields).join(' '));
        }

        return this;
    }
    handleSort() {
        if (this.req.query.sort) {
            try {
                const sortParams = this.req.query.sort.split(',');
                const sortBy = {};

                sortParams.forEach(param => {
                    const [field, order] = param.split(':');
                    if (!field) throw new Error('Invalid sort parameter');
                    sortBy[field.trim()] = order?.toLowerCase() === 'desc' ? -1 : 1;
                });

                if (this.isAggregation) {
                    this.query.pipeline().push({ $sort: sortBy });
                } else {
                    this.query = this.query.sort(sortBy);
                }
            } catch (error) {
                throw new CustomError.BadRequestError('Invalid sort format');
            }
        } else {
            // Default sort by createdAt if exists
            const defaultSort = { createdAt: -1 };
            if (this.isAggregation) {
                this.query.pipeline().push({ $sort: defaultSort });
            } else {
                this.query = this.query.sort(defaultSort);
            }
        }
        return this;
    }

    handlePagination() {
        const requestedLimit = parseInt(this.req.query.limit) || this.config.pagination.defaultLimit;
        const limit = Math.min(Math.max(1, requestedLimit), this.config.pagination.maxLimit);
        const page = Math.max(parseInt(this.req.query.page) || 1, 1);
        const skip = (page - 1) * limit;

        if (skip > this.config.pagination.maxSkip) {
            throw new CustomError.BadRequestError('Page number too large');
        }

        if (this.isAggregation) {
            this.query.pipeline().push(
                { $skip: skip },
                { $limit: limit }
            );
        } else {
            this.query = this.query.skip(skip).limit(limit);
        }

        return this;
    }
    validateFilters(filters) {
        for (const [field, conditions] of Object.entries(filters)) {
            const baseField = field.split('.').pop();
            const allowedOps = this.config.filters?.allowed?.[field] ||
                this.config.filters?.allowed?.[baseField] ||
                [];

            if (typeof conditions === 'object' && conditions !== null) {
                for (const op of Object.keys(conditions)) {
                    const cleanOp = op.replace('$', '');
                    if (!allowedOps.includes(cleanOp)) {
                        throw new CustomError.BadRequestError(
                            `Operation '${cleanOp}' not allowed on field: ${field}`
                        );
                    }
                }
            }
        }
    }

    handlePopulation() {
        try {
            if (!this.config.population?.default?.length) {
                return this;
            }

            if (this.isAggregation) {
                const preservedFields = { _id: 1 };

                this.config.population.default.forEach(popConfig => {
                    const {
                        path,
                        select,
                        match,
                        pathfrom,
                        isVirtual
                    } = popConfig;

                    // Handle virtual populate differently
                    if (isVirtual) {
                        // Add lookup stage
                        this.query.pipeline().push({
                            $lookup: {
                                from: pathfrom || path + 's',
                                localField: '_id',
                                foreignField: 'parentCategory',
                                pipeline: [
                                    ...(match ? [{ $match: match }] : []),
                                    ...(select ? [{
                                        $project: select.split(' ').reduce((acc, field) => {
                                            acc[field] = 1;
                                            return acc;
                                        }, { _id: 1 })
                                    }] : [])
                                ],
                                as: path
                            }
                        });
                    } else {
                        // Original population code for non-virtual fields
                        this.query.pipeline().push({
                            $lookup: {
                                from: pathfrom || this.model.db.collection(path + 's').name,
                                localField: path,
                                foreignField: '_id',
                                as: path
                            }
                        });

                        if (!this.model.schema.virtuals[path]) {
                            this.query.pipeline().push({
                                $unwind: {
                                    path: `$${path}`,
                                    preserveNullAndEmptyArrays: true
                                }
                            });
                        }
                    }

                    // Handle select fields
                    if (select) {
                        select.split(' ').forEach(field => {
                            preservedFields[`${path}.${field}`] = 1;
                        });
                    }
                });

                // Add preserved fields to selectable fields
                Object.keys(preservedFields).forEach(field => {
                    if (!this.config.fields.selectable.includes(field)) {
                        this.config.fields.selectable.push(field);
                    }
                });
            } else {
                // Handle regular populate
                this.config.population.default.forEach(popConfig => {
                    if (typeof popConfig === 'object' && popConfig.path) {
                        this.query = this.query.populate({
                            ...popConfig,
                            model: this.model.db.model(popConfig.pathfrom || popConfig.path)
                        });
                    }
                });
            }
        } catch (error) {
            console.error('Population error:', error);
        }
        return this;
    }


    // Utility methods
    sanitizeQueryParams(params) {
        const sanitized = {};
        for (const [key, value] of Object.entries(params)) {
            if (typeof value === 'string') {
                sanitized[key] = this.sanitizeString(value);
            } else if (Array.isArray(value)) {
                sanitized[key] = value.map(item =>
                    typeof item === 'string' ? this.sanitizeString(item) : item
                );
            } else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    }

    sanitizeString(str) {
        return str
            .replace(/[<>{}$]/g, '') // Remove potentially harmful characters
            .trim()
            .substring(0, 500); // Limit string length
    }

    isValidFieldName(field) {
        // Basic field name validation
        return /^[a-zA-Z0-9_.-]+$/.test(field.trim());
    }

    isValidObjectId(id) {
        return /^[0-9a-fA-F]{24}$/.test(id);
    }
}


// Factory function to create configured instance
const createAPIFeatures = (modelConfig) => {
    return (req, model) => {
        const features = new APIFeatures(req, model, modelConfig);
        return features.execute();
    };
};


const categoryFeatures = {
    pathMappings: {
        subcategory: 'subcategories.name',
    },
    // Enhanced searchable fields
    searchable: [
        'name',
        'description',
        'slug',
        'metadata',
        'subcategories.name',
    ],

    // Extended sortable fields
    sortable: [
        'name',
        'createdAt',
        'updatedAt',
        'displayOrder',
        'featured',
        'status',
        'productCount'
    ],

    // Comprehensive selectable fields
    selectable: [
        'name',
        'description',
        'slug',
        'image.url',
        'parentCategory',
        'displayOrder',
        'featured',
        'status',
        'metadata',
        'productCount',
        'createdAt',
        'updatedAt',
        'subcategories'
    ],

    // Fields to exclude
    excluded: ['__v'],

    // Required fields in response
    required: ['_id', 'name'],

    // Search configuration
    search: {
        useTextIndex: true,
        fuzzySearch: true,
        caseSensitive: false
    },

    // Enhanced filter operations
    filters: {
        // Basic fields
        name: ['eq', 'ne', 'regex', 'in', 'nin'],
        slug: ['eq', 'ne', 'in', 'nin'],
        status: ['eq', 'ne', 'in'],
        featured: ['eq'],
        displayOrder: ['eq', 'gt', 'gte', 'lt', 'lte'],

        'subcategories.name': ['eq', 'ne', 'regex', 'in', 'nin'],
        // Parent category filters
        parentCategory: ['eq'],

        // Date filters
        createdAt: ['gt', 'gte', 'lt', 'lte', 'between'],
        updatedAt: ['gt', 'gte', 'lt', 'lte', 'between'],

        // Virtual field filters
        productCount: ['gt', 'gte', 'lt', 'lte']
    },

    // Add lookup configuration for subcategories
    lookupConfig: {
        'subcategories.name': {
            from: 'categories',
            localField: '_id',
            foreignField: 'parentCategory'
        },
    },

    // Population configuration
    population: {
        default: [
            {
                path: 'subcategories',
                select: 'name description slug image.url status displayOrder featured',
                match: { status: 'active' },  // Only get active subcategories
                options: { sort: { displayOrder: 1 } },  // Sort subcategories by displayOrder
                pathfrom: 'categories',
                isVirtual: true 
            }

        ],
        maxDepth: 2
    },

    // Pagination configuration
    pagination: {
        defaultLimit: 20,
        maxLimit: 50,
        maxSkip: 5000
    }
};


// Create the configured API features instance
const categoryAPIFeatures = createAPIFeatures(categoryFeatures);


const productFeatures = {
    pathMappings : {
            // Direct mappings for simple filters
            category: 'category.name',
        subcategory: 'category.subcategories.name',
            brand: 'brand',
            seller: 'seller.storeName',
    },
    // Fields that can be searched using text search or regex
    searchable: [
        'name',
        'description',
        'shortDescription',
        'brand',
        'status',
        'category.name',
        'category.subcategories.name'
    ],

    // Fields that can be used for sorting
    sortable: [
        'name',
        'basePrice',
        'salePrice',
        'createdAt',
        'updatedAt',
        'ratingsAverage',
        'ratingsQuantity',
        'sold',
        'quantity',
        'stockStatus'
    ],

    // All fields that can be selected in queries
    selectable: [
        'name',
        'basePrice',
        'slug',
        'mainImage.url',
        'images.url',
        'description',
        'shortDescription',
        /* 'category',
        'subcategory',
        'seller', */
        'brand',
        'inventoryManagement',
        'quantity',
        'lowStockThreshold',
        'isOutOfStock',
        'isLowStock',
        'allowBackorders',
        'backorderLimit',
        'backorderCount',
        'reservedQuantity',
        'sold',
        'stockStatus',
        'restockDate',
        'attributes',
        'variations',
        'hasVariations',
        'salePrice',
        'saleStartDate',
        'saleEndDate',
        'taxRate',
        'shippingOptions',
        'shippingWeight',
        'dimensions',
        'isDigital',
        'digitalDownloadInfo',
        'status',
        'metadata',
        'ratingsAverage',
        'ratingsQuantity',
        'createdAt',
        'updatedAt'
    ],

    // Fields to exclude from responses
    excluded: ['__v'],

    // Fields that must always be returned
    required: ['_id', 'name', 'basePrice', 'status'],

    // Search configuration
    useTextIndex: true,
    fuzzySearch: true,
    caseSensitive: false,

    // Define allowed filter operations for each field
    filters: {
        // Basic product details
        name: ['eq', 'ne', 'regex'],
        slug: ['eq', 'ne'],
        brand: ['eq', 'ne', 'in', 'nin'],
        status: ['eq', 'ne', 'in'],

        // Pricing filters
        basePrice: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between'],
        salePrice: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between'],
        taxRate: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte'],

        // Inventory filters
        quantity: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte'],
        stockStatus: ['eq', 'ne', 'in'],
        isOutOfStock: ['eq'],
        isLowStock: ['eq'],
        allowBackorders: ['eq'],

        // Category and seller filters
        'category.name': ['eq', 'in'],
        'category.subcategories.name': ['eq', 'in'],
        'seller.firstname': ['eq', 'in'],
        'seller.lastname': ['eq', 'in'],
        'seller.storeName': ['eq', 'in'],

        // Rating filters
        ratingsAverage: ['gt', 'gte', 'lt', 'lte', 'between'],
        ratingsQuantity: ['gt', 'gte', 'lt', 'lte'],
        
        // Product type filters
        isDigital: ['eq'],
        hasVariations: ['eq'],

        // Date filters
        createdAt: ['gt', 'gte', 'lt', 'lte', 'between'],
        updatedAt: ['gt', 'gte', 'lt', 'lte', 'between'],
        saleStartDate: ['gt', 'gte', 'lt', 'lte', 'between'],
        saleEndDate: ['gt', 'gte', 'lt', 'lte', 'between']
    },

    // Population configuration
    population: {
        default: [
            { path: 'category', select: 'name subcategories' , pathfrom : 'categories' },
            { path: 'seller', select: 'firstname lastname storeName profilePicture' ,pathfrom:'users'}
        ],
        maxDepth: 2
    },
    lookupConfig: {
        'category.name': {
            from: 'categories',
            localField: 'category',
            foreignField: '_id'
        },
        'subcategory.name': {
            from: 'categories',
            localField: 'category',
            foreignField: '_id'
        },
        'seller.storeName': {
            from: 'users',
            localField: 'seller',
            foreignField: '_id'
        },
    },
    // Pagination configuration
    pagination: {
        defaultLimit: 24,
        maxLimit: 100,
        maxSkip: 10000
    }
};
const productAPIFeatures = createAPIFeatures(productFeatures);



const sellerProductFeatures = {
    pathMappings: {
        category: 'category.name',
        subcategory: 'subcategory.name'
    },

    // Searchable fields for seller products
    searchable: [
        'name',
        'description',
        'shortDescription',
        'brand',
        'sku',
        'category.name',
        'subcategory.name'
    ],

    // Sortable fields
    sortable: [
        'name',
        'basePrice',
        'createdAt',
        'updatedAt',
        'quantity',
        'sold',
        'stockStatus',
        'status'
    ],

    // Selectable fields
    selectable: [
        'name',
        'slug',
        'basePrice',
        'salePrice',
        'mainImage.url',
        'images.url',
        'category',
        'subcategory',
        'brand',
        'quantity',
        'sold',
        'stockStatus',
        'status',
        'ratingsAverage',
        'ratingsQuantity',
        'createdAt',
        'updatedAt'
    ],

    // Excluded fields
    excluded: ['__v', 'metadata'],

    // Required fields
    required: ['_id', 'name', 'status', 'stockStatus'],

    // Search configuration
    search: {
        useTextIndex: true,
        fuzzySearch: true,
        caseSensitive: false
    },

    // Filter configuration
    filters: {
        // Basic product details
        name: ['eq', 'ne', 'regex'],
        sku: ['eq', 'ne', 'in'],
        brand: ['eq', 'ne', 'in'],
        status: ['eq', 'ne', 'in'],
        stockStatus: ['eq', 'ne', 'in'],

        // Pricing filters
        basePrice: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte'],
        salePrice: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte'],

        // Inventory filters
        quantity: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte'],
        sold: ['gt', 'gte', 'lt', 'lte'],

        // Category filters
        'category.name': ['eq', 'in'],
        'category.subcategories.name': ['eq', 'in'],

        // Date filters
        createdAt: ['gt', 'gte', 'lt', 'lte'],
        updatedAt: ['gt', 'gte', 'lt', 'lte']
    },

    // Lookup configuration for populated fields
    lookupConfig: {
        'category.name': {
            from: 'categories',
            localField: 'category',
            foreignField: '_id'
        },
        'category.subcategories.name': {  // Updated lookup config
            from: 'categories',
            localField: 'category',
            foreignField: '_id'
        },
        'seller.storeName': {
            from: 'users',
            localField: 'seller',
            foreignField: '_id'
        }
    },

    // population configuration
    population: {
        default: [
            {
                path: 'category',
                select: 'name subcategories',  // Include subcategories in selection
                pathfrom: 'categories'
            },
            {
                path: 'seller',
                select: 'firstname lastname storeName profilePicture',
                pathfrom: 'users'
            }
        ],
        maxDepth: 2
    },

    // Pagination configuration
    pagination: {
        defaultLimit: 20,
        maxLimit: 50,
        maxSkip: 5000
    }
};

// Create the configured API features instance
const sellerProductsAPIFeatures = createAPIFeatures(sellerProductFeatures);


module.exports = {
    APIFeatures,
    createAPIFeatures,
    // Export the configured instance
    categoryAPIFeatures,
    productAPIFeatures,
    sellerProductsAPIFeatures
};