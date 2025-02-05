const CustomError = require('../errors');
const mongoose = require('mongoose');

class APIFeatures {
    constructor(req, model, options = {}) {
        this.req = req;
        this.model = model;
        // Configure lookup settings for populated fields
        this.lookupConfig = options.lookupConfig || {
            // Default format:
            // fieldPath: { from: 'collectionName', localField: 'fieldName', foreignField: '_id' }
            // Example:
            // 'category.name': { from: 'categories', localField: 'category', foreignField: '_id' }
        };

        this.config = {
            pagination: {
                strategy: options.pagination?.strategy || 'auto', // 'auto', 'cursor', or 'offset'
                defaultLimit: options.pagination?.defaultLimit || 25,
                maxLimit: options.pagination?.maxLimit || 100,
                maxSkip: options.pagination?.maxSkip || 10000
            },

            //  cursor configuration
            cursor: {
                enabled: options.cursor?.enabled ?? false,
                field: options.cursor?.field || '_id',
                encoding: options.cursor?.encoding || 'base64',
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
            },

            // ObjectId fields for query processing
            objectIdFields: options.objectIdFields || [],
            forceAggregation: options.forceAggregation || false
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
            // Determine pagination strategy
            const shouldUseCursor = this.shouldUseCursorPagination();
            if (shouldUseCursor) {
                this.handleCursorPagination();
            } else {
                this.handlePagination();
            }

            return this.executeQuery();
        } catch (error) {
            throw new CustomError.BadRequestError(`Query execution failed: ${error.message}`);
        }
    }
    shouldUseCursorPagination() {
        const explicitCursorStrategy = this.config.pagination.strategy === 'cursor';
        const hasCursor = Boolean(this.req.query.cursor);
        const cursorEnabled = this.config.cursor.enabled;

        return explicitCursorStrategy ||
            (cursorEnabled && (hasCursor || !this.req.query.page));
    }

    buildCursorQuery(cursor) {
        const sortOrder = this.getSortOrder();
        const cursorQuery = {};


            const field = this.config.cursor.field;
            const operator =sortOrder[field] === 1 ? '$gt' : '$lt'

            cursorQuery[field] = { [operator]: cursor };


        return cursorQuery;
    }

    async executeQuery() {
        try {
            const results = await this.query;
            console.log(results.length)

            let nextCursor = null;
            let hasNextPage = false;

            // Handle cursor pagination results
            if (this.shouldUseCursorPagination() && results.length > 0) {
                const limit = Math.min(
                    parseInt(this.req.query.limit) || this.config.pagination.defaultLimit,
                    this.config.pagination.maxLimit
                );

                // If we got more results than limit, we have a next page
                if (results.length > limit) {
                    // Remove the extra result used for cursor calculation
                    results.pop();
                    hasNextPage = true;

                    // Generate next cursor from the last document
                    const lastDoc = results[results.length - 1];
                    nextCursor = this.generateCursor(lastDoc);
                }
            }

            // Calculate total only for offset pagination
            let total;
            if (!this.shouldUseCursorPagination()) {
                if (this.isAggregation) {
                    const countPipeline = this.query.pipeline()
                        .filter(stage => !stage.$skip && !stage.$limit);
                    const countResult = await this.model.aggregate([
                        ...countPipeline,
                        { $count: 'total' }
                    ]);
                    total = countResult[0]?.total || 0;
                } else {
                    total = await this.model.countDocuments(this.queryObj);
                }
            }

            const limit = Math.min(
                parseInt(this.req.query.limit) || this.config.pagination.defaultLimit,
                this.config.pagination.maxLimit
            );

            return {
                success: true,
                count: results.length,
                total: this.shouldUseCursorPagination() ? undefined : total,
                pages: this.shouldUseCursorPagination() ? undefined : Math.ceil(total / limit),
                currentPage: this.shouldUseCursorPagination() ? undefined : parseInt(this.req.query.page) || 1,
                nextCursor: this.shouldUseCursorPagination() ? nextCursor : undefined,
                hasNextPage: this.shouldUseCursorPagination() ? hasNextPage : undefined,
                data: results
            };
        } catch (error) {
            console.error('Query execution error:', error);
            throw new CustomError.BadRequestError(`Query execution failed: ${error.message}`);
        }
    }


    buildQuery() {
        try {
            const reqQuery = this.sanitizeQueryParams({ ...this.req.query });
            const removeFields = ['select', 'sort', 'page', 'limit', 'filter', 'search', 'cursor', 'prevCursor'];
            removeFields.forEach(param => delete reqQuery[param]);
            delete reqQuery._id;

            // Process and validate filters
            const processedQuery = this.processFilters(reqQuery);
            const objectIdFields = this.config.objectIdFields;
            const baseQuery = this.processQueryFields(processedQuery, objectIdFields);

            // Rest of the buildQuery method remains the same
            const isTextSearch = this.config.search.useTextIndex && this.req.query.search;

            if (this.config.forceAggregation || isTextSearch) {
                this.isAggregation = true;
                const pipeline = !isTextSearch && Object.keys(baseQuery).length > 0
                    ? [{ $match: baseQuery }]
                    : [];
                this.query = this.model.aggregate(pipeline);
            } else {
                const pipeline = Object.keys(baseQuery).length > 0
                    ? [{ $match: baseQuery }]
                    : [];

                if (pipeline.length > 0) {
                    this.query = this.model.aggregate(pipeline);
                    this.isAggregation = true;
                } else {
                    this.query = this.model.find(baseQuery);
                    this.isAggregation = false;
                }
            }

            this.queryObj = baseQuery;
            return this;
        } catch (error) {
            throw new CustomError.BadRequestError(`Query building failed: ${error.message}`);
        }
    }

    processFilters(reqQuery) {
        const processedQuery = {};

        for (const [field, value] of Object.entries(reqQuery)) {
            try {
                // Skip special query parameters
                if (['select', 'sort', 'page', 'limit', 'search', 'cursor', 'prevCursor'].includes(field)) {
                    continue;
                }

                // Handle the field mapping and validation
                const mappedFields = this.resolveFieldMapping(field, value);

                for (const { mappedField, filterValue } of mappedFields) {
                    if (mappedField) {
                        // Validate the filter operation
                        this.validateFilterOperation(mappedField, filterValue);
                        processedQuery[mappedField] = filterValue;
                    }
                }
            } catch (error) {
                throw new CustomError.BadRequestError(`Invalid filter for field '${field}': ${error.message}`);
            }
        }

        return processedQuery;
    }

    resolveFieldMapping(field, value) {
        const mappedFields = [];

        // Handle dot notation fields directly
        if (field.includes('.')) {
            mappedFields.push({
                mappedField: field,
                filterValue: this.parseQueryValue(value)
            });
            return mappedFields;
        }

        // Check if there's a lookup config for this field
        const lookupField = `${field}.name`;
        if (this.config.lookupConfig && this.config.lookupConfig[lookupField]) {
            // If the field is in objectIdFields, handle both the ID and lookup field
            if (this.config.objectIdFields?.includes(field)) {
                // Try to convert the value to ObjectId for direct field
                try {
                    const objectIdValue = new mongoose.Types.ObjectId(value);
                    mappedFields.push({
                        mappedField: field,
                        filterValue: objectIdValue
                    });
                } catch (error) {
                    // If value is not an ObjectId, use the lookup field
                    mappedFields.push({
                        mappedField: lookupField,
                        filterValue: this.parseQueryValue(value)
                    });
                }
            } else {
                // If not an objectIdField, just use the lookup field
                mappedFields.push({
                    mappedField: lookupField,
                    filterValue: this.parseQueryValue(value)
                });
            }
        } else if (this.isValidFieldName(field)) {
            // Handle regular fields
            mappedFields.push({
                mappedField: field,
                filterValue: this.parseQueryValue(value)
            });
        }

        return mappedFields;
    }

    validateFilterOperation(field, value) {
        // Get the base field name (without nested path)
        const baseField = field.split('.')[0];

        // Get allowed operations for this field
        const allowedOps = this.config.filters.allowed[field] || [];

        if (allowedOps.length === 0) {
            throw new Error(`Filtering not allowed for field: ${field}`);
        }

        // If value is an object (has operators)
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            for (const op of Object.keys(value)) {
                const cleanOp = op.replace('$', '');
                if (!allowedOps.includes(cleanOp)) {
                    throw new Error(`Operation '${cleanOp}' not allowed on field: ${field}`);
                }
            }
        } else {
            // For direct value comparison, check if 'eq' is allowed
            if (!allowedOps.includes('eq')) {
                throw new Error(`Equals comparison not allowed on field: ${field}`);
            }
        }
    }

    convertToObjectId(value) {
        // Check if value is already an ObjectId
        if (value instanceof mongoose.Types.ObjectId) return value;

        try {
            return new mongoose.Types.ObjectId(value.toString());
        } catch (error) {
            return value;
        }
    }

    processQueryFields(query, objectIdFields = []) {
        const processedQuery = { ...query };

        for (const [field, value] of Object.entries(processedQuery)) {
            // Convert to ObjectId if the field is in objectIdFields list
            if (objectIdFields.includes(field)) {
                processedQuery[field] = this.convertToObjectId(value);
            }
            // Convert numeric strings to numbers
            else if (typeof value === 'string' && !isNaN(value) && value.trim() !== '') {
                processedQuery[field] = Number(value);
            }
            // Handle object conditions (like {gte: '100'})
            else if (typeof value === 'object' && value !== null) {
                Object.keys(value).forEach(key => {
                    if (typeof value[key] === 'string' && !isNaN(value[key]) && value[key].trim() !== '') {
                        // Convert string to number
                        value[key] = Number(value[key]);

                        // Add the $ prefix to the key
                        const newKey = `$${key}`;

                        // Update the object with the new key and delete the old key
                        value[newKey] = value[key];
                        delete value[key];
                    }
                });
            }
        }

        return processedQuery;
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
            console.log(this.config.search.useTextIndex)
            if (this.config.search.useTextIndex) {
                // For text index search
                const textSearchStage = {
                    $match: {
                        $text: {
                            $search: searchTerm,
                            $caseSensitive: this.config.search.caseSensitive
                        }
                    }
                };

                if (this.isAggregation) {
                    // Get current pipeline
                    const currentPipeline = this.query.pipeline();

                    // Remove any existing $match stages that might interfere
                    const nonMatchStages = currentPipeline.filter(stage => !stage.$match);

                    // Create new pipeline with text search as first stage
                    const newPipeline = [textSearchStage, ...nonMatchStages];

                    // Reset the pipeline
                    this.query = this.model.aggregate(newPipeline);
                } else {
                    // Convert to aggregation pipeline for text search
                    this.isAggregation = true;
                    const pipeline = [
                        textSearchStage,
                        // Add any existing query conditions
                        ...(Object.keys(this.queryObj).length > 0 ? [{
                            $match: this.queryObj
                        }] : [])
                    ];
                    this.query = this.model.aggregate(pipeline);
                }
            } else {
                // For regex search
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
                    .forEach(field => {
                        // Remove parent paths of populated fields when select is undefined
                        if (!this.config.population?.default?.some(pop => pop.path === field)) {
                            fields.add(field);
                        }
                    });
            } else {

                this.config.fields.selectable.forEach(field => {
                    // Remove parent paths of populated fields when select is undefined
                    if (!this.config.population?.default?.some(pop => pop.path === field)) {
                        fields.add(field);
                    }
                });
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
            console.log("fieldProjection", fieldProjection)
            // For aggregation, add a $project stage
            this.query.pipeline().push({
                $project: fieldProjection
            });
        } else {
            // For regular queries, use select
            console.log("fields", fields)
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
    handleCursorPagination() {
        const cursor = this.decodeCursor(this.req.query.cursor);
        const limit = Math.min(
            parseInt(this.req.query.limit) || this.config.pagination.defaultLimit,
            this.config.pagination.maxLimit
        );


        if (cursor) {
            const cursorQuery = this.buildCursorQuery(cursor);

            if (this.isAggregation) {
                this.query.pipeline().push({ $match: cursorQuery });
            } else {
                this.query = this.query.where(cursorQuery);
            }
        }

        // Add sort to ensure consistent ordering
        const sortOrder = this.getSortOrder();

        if (this.isAggregation) {
            this.query.pipeline().push({ $sort: sortOrder });
        } else {
            this.query = this.query.sort(sortOrder);
        }

        // Add limit (get one extra for cursor)
        if (this.isAggregation) {
            this.query.pipeline().push({ $limit: limit + 1 });
        } else {
            this.query = this.query.limit(limit + 1);
        }

        return this;
    }



    getSortOrder() {
        if (this.req.query.sort) {
            const sortParams = this.req.query.sort.split(',');
            const sortBy = {};

            sortParams.forEach(param => {
                const [field, order] = param.split(':');
                if (field) {
                    sortBy[field.trim()] = order?.toLowerCase() === 'desc' ? -1 : 1;
                }
            });

            return sortBy;
        }

        // Default sort
        return { [this.config.cursor.field]: -1 };
    }

    decodeCursor(cursor) {
        if (!cursor) return null;

        try {
            const decoded = Buffer.from(cursor, 'base64').toString();
            const values = decoded.split(',').map(value => {
                // Enhanced parsing logic
                if (value === '') return null;

                // Try parsing as date
                const dateValue = new Date(value);
                if (!isNaN(dateValue.getTime())) return dateValue;

                // Try parsing as ObjectId
                try {
                    return new mongoose.Types.ObjectId(value);
                } catch {
                    // If not ObjectId, return as is
                    return isNaN(value) ? value : Number(value);
                }
            });

            // Handle compound and simple cursors
            return values[0];

        } catch (error) {
            console.error('Cursor Decoding Error:', error);
            throw new CustomError.BadRequestError('Invalid cursor format');
        }
    }

    generateCursor(doc) {
        if (!doc) return null;

        const sortOrder = this.getSortOrder();
        const cursorFields =  [this.config.cursor.field];

        const values = cursorFields.map(field => {
            const value = doc[field];
            const isDescending = sortOrder[field] === -1;

            if (value instanceof Date) {
                return value.toISOString();
            }

            // Handle potential undefined values
            return value !== undefined ? value.toString() : '';
        });

        return this.encodeCursor(values.join(','));
    }


    // Helper method to check if a field is a date field
    isDateField(field) {
        // Check if the field exists in the schema and is of type Date
        const schemaPath = this.model.schema.path(field);
        return schemaPath && schemaPath.instance === 'Date';
    }

    // Also update the encodeCursor method for consistency
    encodeCursor(value) {
        if (!value) return null;

        try {
            if (this.config.cursor.encoding === 'base64') {
                // Convert ObjectId to string if necessary
                const stringValue = value instanceof mongoose.Types.ObjectId ?
                    value.toString() :
                    value.toString();

                return Buffer.from(stringValue).toString('base64');
            }

            return value.toString();
        } catch (error) {
            throw new CustomError.BadRequestError('Failed to encode cursor value');
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
    // Enhanced searchable fields
    searchable: [
        'name',
        'description',
        'shortDescription',
        'slug',
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

    useTextIndex: false,
    fuzzySearch: true,
    caseSensitive: false,


    // Enhanced filter operations
    filters: {
        // Basic fields
        name: ['eq', 'ne', 'regex', 'in', 'nin'],
        slug: ['eq', 'ne', 'in', 'nin'],
        status: ['eq', 'ne', 'in'],
        featured: ['eq'],
        displayOrder: ['eq', 'gt', 'gte', 'lt', 'lte'],

        // 'subcategories.name': ['eq', 'ne', 'regex', 'in', 'nin'],
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
        strategy: 'offset',
    },
};


// Create the configured API features instance
const categoryAPIFeatures = createAPIFeatures(categoryFeatures);


const productFeatures = {

    // Fields that can be searched using text search or regex
    searchable: [
        'name',
        'description',
        'shortDescription',
        'brand',
        'status',
        'category.name',
        'subcategory.name'
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
        'category',
        'subcategory',
        'seller',
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
    useTextIndex: false,
    fuzzySearch: true,
    caseSensitive: false,

    // Define allowed filter operations for each field
    filters: {
        // Basic product details
        name: ['eq', 'ne', 'regex'],
        slug: ['eq', 'ne'],
        brand: ['eq', 'ne', 'in', 'nin', 'regex'],
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


        'category': ['eq', 'in'],
        'category.name': ['eq', 'in'],
        'subcategory': ['eq', 'in'],
        'subcategory.name': ['eq', 'in'],


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
            {
                path: 'category',
                select: 'name',
                pathfrom: 'categories',
                match: { status: 'active' }, // Add status filter
            },
            {
                path: 'subcategory',
                select: 'name',
                pathfrom: 'categories',
                match: { status: 'active' },// Add status filter
            },
            {
                path: 'seller',
                select: 'firstname lastname storeName profilePicture',
                pathfrom: 'users'
            }
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
            localField: 'subcategory',
            foreignField: '_id'
        },
        'seller.storeName': {
            from: 'users',
            localField: 'seller',
            foreignField: '_id'
        }
    },
    objectIdFields: ['category', 'subcategory', 'seller'],
    forceAggregation: true,
    // Pagination configuration
    pagination: {
        strategy: 'auto', // or 'cursor' or 'offset'
    },
    cursor: {
        enabled: true,
        field: '_id',
    }
};
const productAPIFeatures = createAPIFeatures(productFeatures);



const sellerProductFeatures = {


    searchable: [
        'name',
        'description',
        'shortDescription',
        'brand',
        'sku',
        'category.name',
        'subcategory.name'
    ],

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

    selectable: [
        '_id',
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

    excluded: ['__v', 'metadata'],

    required: ['_id', 'name', 'status', 'stockStatus'],

    search: {
        useTextIndex: false,
        fuzzySearch: true,
        caseSensitive: false
    },

    filters: {
        name: ['eq', 'ne', 'regex'],
        sku: ['eq', 'ne', 'in'],
        brand: ['eq', 'ne', 'in'],
        status: ['eq', 'ne', 'in'],
        stockStatus: ['eq', 'ne', 'in'],
        basePrice: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte'],
        salePrice: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte'],
        quantity: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte'],
        sold: ['gt', 'gte', 'lt', 'lte'],
        'category.name': ['eq', 'in'],
        'subcategory.name': ['eq', 'in'],
        seller: ['eq', 'in'],
        createdAt: ['gt', 'gte', 'lt', 'lte'],
        updatedAt: ['gt', 'gte', 'lt', 'lte']
    },

    lookupConfig: {
        'category.name': {
            from: 'categories',
            localField: 'category',
            foreignField: '_id'
        },
        'subcategory.name': {
            from: 'categories',
            localField: 'subcategory',
            foreignField: '_id'
        }
    },
    objectIdFields: ['seller'],
    population: {
        default: [
            {
                path: 'category',
                select: 'name',
                pathfrom: 'categories'
            },
            {
                path: 'subcategory',
                select: 'name',
                pathfrom: 'categories',
            }
        ],
        maxDepth: 2
    },

    pagination: {
        strategy: 'offset',
        defaultLimit: 20,
        maxLimit: 50,
        maxSkip: 5000
    },
    cursor: {
        enabled: false,
    }
};

// Create the configured API features instance
const sellerProductsAPIFeatures = createAPIFeatures(sellerProductFeatures);

const userFeatures = {
    // Fields that can be searched using text search or regex
    searchable: [
        'firstname',
        'lastname',
        'email',
        'mobile',
        'storeName'
    ],

    // Fields that can be used for sorting
    sortable: [
        'firstname',
        'lastname',
        'createdAt',
        'updatedAt',
        'balance',
        'role',
        'storeName'
    ],

    // Fields that can be selected in queries
    selectable: [
        'firstname',
        'lastname',
        'email',
        'mobile',
        'role',
        'isBlocked',
        'storeName',
        'balance',
        'profilePicture.url',
        'address',
        'storeDetails',
        'isVerified',
        'verified',
        'termsAccepted',
        'termsAcceptedAt',
        'termsVersion',
        'createdAt',
        'updatedAt'
    ],

    // Fields to exclude from responses
    excluded: [
        'password',
        'refreshToken',
        'verificationToken',
        'vericationTokenExpirationDate',
        'oauth',
        'googleId',
        'facebookId',
        'appleId',
        '__v'
    ],

    // Fields that must always be returned
    required: ['_id', 'firstname', 'lastname', 'role'],

    // Search configuration
    search: {
        useTextIndex: true, // Using text index since UserSchema has text index on firstname and lastname
        fuzzySearch: false,
        caseSensitive: false
    },

    // Define allowed filter operations for each field
    filters: {
        // Basic user details
        firstname: ['eq', 'ne', 'regex'],
        lastname: ['eq', 'ne', 'regex'],
        email: ['eq', 'ne'],
        mobile: ['eq', 'ne'],
        role: ['eq', 'in','nin'],
        isBlocked: ['eq'],
        storeName: ['eq', 'ne', 'regex'],

        // Store details filters
        'storeDetails.country': ['eq', 'in'],
        'storeDetails.state': ['eq', 'in'],
        'storeDetails.city': ['eq', 'in'],

        // Account status filters
        isVerified: ['eq'],
        termsAccepted: ['eq'],

        // Balance range filters
        balance: ['eq', 'gt', 'gte', 'lt', 'lte'],

        // Date filters
        createdAt: ['gt', 'gte', 'lt', 'lte', 'between'],
        updatedAt: ['gt', 'gte', 'lt', 'lte', 'between'],
        verified: ['gt', 'gte', 'lt', 'lte'],
        termsAcceptedAt: ['gt', 'gte', 'lt', 'lte']
    },

    // Population configuration
    population: {
        default: [
            {
                path: 'cart',
                select: 'items',
                pathfrom: 'Cart'
            },
            {
                path: 'wishlist',
                select: 'products',
                pathfrom: 'Favourite'
            }
        ],
        maxDepth: 2
    },

    // Pagination configuration
    pagination: {
        strategy: 'offset',
        defaultLimit: 20,
        maxLimit: 50,
        maxSkip: 5000
    },
};

// Create the configured API features instance
const userAPIFeatures = createAPIFeatures(userFeatures);

module.exports = {
    APIFeatures,
    createAPIFeatures,
    // Export the configured instance
    userAPIFeatures,
    categoryAPIFeatures,
    productAPIFeatures,
    sellerProductsAPIFeatures
};