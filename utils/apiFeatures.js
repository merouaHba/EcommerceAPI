const CustomError = require('../errors');

class APIFeatures {
    constructor(req, model, options = {}) {
        this.req = req;
        this.model = model;

        this.config = {
            pagination: {
                defaultLimit: 25,
                maxLimit: 100,
                maxSkip: 10000
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

                // Fields that can be populated
                populatable: options.populatable || []
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
                    status: ['eq', 'ne', 'in'],
                    // Add more field-specific filter operations
                }
            },

            // Population configuration
            population: {
                default: options.defaultPopulate || [],
                maxDepth: options.maxPopulateDepth || 2
            }
        };

        this.query = null;
        this.queryObj = {};
    }

    async execute() {
        try {
            await this.buildQuery()
                .handleSearch()
                .handleSelect()
                .handleSort()
                .handlePagination()
                .handlePopulation();

            return this.executeQuery();
        } catch (error) {
            throw new CustomError.BadRequestError(`Query execution failed: ${error.message}`);
        }
    }

    buildQuery() {
        const reqQuery = this.sanitizeQueryParams({ ...this.req.query });
        const removeFields = ['select', 'sort', 'page', 'limit', 'filter', 'search', 'cursor'];

        removeFields.forEach(param => delete reqQuery[param]);
        delete reqQuery._id;

        let queryStr = JSON.stringify(reqQuery);
        queryStr = queryStr.replace(
            /\b(gt|gte|lt|lte|in|nin|eq|ne|regex)\b/g,
            match => `$${match}`
        );

        this.queryObj = JSON.parse(queryStr);
        this.validateFilters(this.queryObj);
        this.query = this.model.find(this.queryObj);

        return this;
    }

    handleSearch() {
        if (this.req.query.search) {
            const searchTerm = this.sanitizeString(this.req.query.search);
            const searchFields = this.config.fields.searchable;

            if (this.config.search.useTextIndex) {
                this.queryObj.$text = {
                    $search: searchTerm,
                    $caseSensitive: this.config.search.caseSensitive
                };
            } else {
                const searchConditions = searchFields.map(field => ({
                    [field]: {
                        $regex: this.config.search.fuzzySearch ?
                            new RegExp(searchTerm.split('').join('.*'), 'i') :
                            new RegExp(searchTerm, this.config.search.caseSensitive ? '' : 'i')
                    }
                }));

                this.queryObj.$or = searchConditions;
            }

            this.query = this.model.find(this.queryObj);
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
                // If all fields are selectable, add all requested fields
                requestedFields.forEach(field => fields.add(field));
            } else {
                // Only add fields that are in the selectable list
                requestedFields
                    .filter(field => this.config.fields.selectable.includes(field))
                    .forEach(field => fields.add(field));
            }
        } else {
            // If no fields are specified, add all selectable fields
            if (this.config.fields.selectable.includes('*')) {
                // Add all fields except excluded ones
                const modelFields = Object.keys(this.model.schema.paths);
                modelFields
                    .filter(field => !this.config.fields.excluded.includes(field))
                    .forEach(field => fields.add(field));
            } else {
                // Add only specifically allowed fields
                this.config.fields.selectable.forEach(field => fields.add(field));
            }
        }

        // Remove excluded fields
        this.config.fields.excluded.forEach(field => fields.delete(field));

        // Convert Set to space-separated string
        const fieldString = Array.from(fields).join(' ');
        this.query = this.query.select(fieldString);

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

                this.query = this.query.sort(sortBy);
            } catch (error) {
                throw new CustomError.BadRequestError('Invalid sort format');
            }
        } else {
            // Default sort by createdAt if exists
            this.query = this.query.sort('-createdAt');
        }
        return this;
    }
    validateFilters(filters) {
        for (const [field, operations] of Object.entries(filters)) {
            const allowedOps = this.config.filters.allowed[field];
            if (!allowedOps) {
                throw new CustomError.BadRequestError(`Filtering not allowed on field: ${field}`);
            }

            for (const op of Object.keys(operations)) {
                const cleanOp = op.replace('$', '');
                if (!allowedOps.includes(cleanOp)) {
                    throw new CustomError.BadRequestError(
                        `Operation '${cleanOp}' not allowed on field: ${field}`
                    );
                }
            }
        }
    }

    handlePagination() {
        // Sanitize and validate limit
        const requestedLimit = parseInt(this.req.query.limit) || this.config.defaultLimit;
        const limit = Math.min(Math.max(1, requestedLimit), this.config.maxLimit);

        if (this.req.query.cursor) {
            // Cursor-based pagination
            if (!this.isValidObjectId(this.req.query.cursor)) {
                throw new CustomError.BadRequestError('Invalid cursor format');
            }

            const cursorQuery = {
                _id: { $gt: this.req.query.cursor }
            };
            this.query = this.query.find(cursorQuery).limit(limit);
        } else {
            // Offset-based pagination
            const page = Math.max(parseInt(this.req.query.page) || 1, 1);
            const skip = (page - 1) * limit;

            // Prevent large skip values
            if (skip > 10000) {
                throw new CustomError.BadRequestError('Page number too large');
            }

            this.query = this.query.skip(skip).limit(limit);
        }
        return this;
    }

    handlePopulation() {
        if (this.population && Array.isArray(this.population)) {
            this.population.forEach(populate => {
                if (Array.isArray(populate) && populate.length > 0) {
                    this.query = this.query.populate(...populate);
                }
            });
        }
        return this;
    }

    async executeQuery() {
        try {
            // Add timeout to prevent long-running queries
            this.query = this.query.maxTimeMS(5000);

            const results = await this.query;

            // Get total count for offset pagination
            const total = !this.req.query.cursor ?
                await this.model.countDocuments(this.queryObj).maxTimeMS(5000) :
                null;

            const limit = Math.min(
                parseInt(this.req.query.limit) || this.config.defaultLimit,
                this.config.maxLimit
            );

            // Prepare next cursor for cursor-based pagination
            const nextCursor = results.length && this.req.query.cursor ?
                results[results.length - 1]._id :
                null;

            return {
                success: true,
                count: results.length,
                total,
                pages: !this.req.query.cursor ?
                    (Math.ceil(total / limit) === 0 && results.length ? 1 : Math.ceil(total / limit)) :
                    undefined,
                currentPage: !this.req.query.cursor ?
                    parseInt(this.req.query.page) || 1 :
                    undefined,
                nextCursor,
                data: results
            };
        } catch (error) {
            throw new CustomError.BadRequestError(
                `Query execution failed: ${error.message}`
            );
        }
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
    // Searchable fields - utilizing the text index defined in schema
    searchable: ['name', 'description', 'subcategories.name', 'subcategories.description'],

    // Fields that can be sorted
    sortable: [
        'name',
        'createdAt',
        'updatedAt'
    ],

    // All fields that can be selected in queries
    selectable: [
        '*',
    ],

    // No sensitive fields to exclude in this schema
    excluded: [],

    // Fields that must always be returned
    required: ['_id', 'name'],

    // Enable text index searching since we defined it in the schema
    useTextIndex: true,

    // Enable fuzzy search for better matching
    fuzzySearch: true,

    // Define allowed filter operations for each field
    filters: {
        // Main category fields
        name: ['eq', 'ne', 'regex'],
        createdAt: ['gt', 'gte', 'lt', 'lte'],
        updatedAt: ['gt', 'gte', 'lt', 'lte'],
    },

    // Pagination defaults
    pagination: {
        defaultLimit: 10,
        maxLimit: 50
    }
};

// Create the configured API features instance
const categoryAPIFeatures = createAPIFeatures(categoryFeatures);



module.exports = {
    APIFeatures,
    createAPIFeatures,
    // Export the configured instance
    categoryAPIFeatures
};