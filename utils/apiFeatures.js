// Utils
const CustomError = require('../errors');


const apiFeatures = async (req, model, population) => {
    let query;
console.log(req.query)
    // Copy req.query
    const reqQuery = { ...req.query };

    // Fields to exclude
    const removeFields = ['select', 'sort', 'page', 'limit', 'filter', 'search', 'cursor'];

    // Loop over removeFields and delete them from reqQuery
    removeFields.forEach((param) => delete reqQuery[param]);

    // delete _id from query 
    delete reqQuery['_id']

    // Create query string
    let queryStr = JSON.stringify(reqQuery);

    // Create operators ($gt, $gte, etc)
    queryStr = queryStr.replace(
        /\b(gt|gte|lt|lte|in)\b/g,
        (match) => `$${match}`
    );
    queryObj = JSON.parse(queryStr)
   
    // example price[gt]=400,price[in]=400,5000 name=hp


    // filter 
    // /items?filter={'price':{"gt":100,"lt":500},category:{in:["electronics","appliances"]}}
    // if (req.query.filter) {

    //     // Parse and transform the filter
    //     try {
    //         filterQueryObj = JSON.parse(filter)
    //     } catch (error) {
    //         throw new CustomError.BadRequestError('Invalid Filter Format');
    //     }
    //     let filter = JSON.parse(req.query.filter);

    //     // Replace operators with MongoDB syntax $gt ..
    //     filter = JSON.stringify(filter).replace(
    //         /\b(gt|gte|lt|lte|in|ne|eq)\b/g,
    //         (match) => `$${match}`
    //     );
      
    //     try {
    //         filterQueryObj = JSON.parse(filter)
    //     } catch (error) {
    //         throw new CustomError.BadRequestError('Invalid Filter Format');
    //     }

    //     // Validate filter format
    //     if (typeof filterQueryObj !== 'object' || Array.isArray(filterQueryObj)) {
    //         throw new CustomError.BadRequestError('Filter must be an object');
    //     }

    //     // Check if filterQueryObj matches the expected format using a regex
    //     // const expectedFormatRegex = /^{([^{}]+:(?:{[^{}]+(?:$gt|$gte|$lt|$lte|$in):[^{}]+}|{in:\[[^{}]+\]}),?)+}$/;
    //     // if (!expectedFormatRegex.test(JSON.stringify(filterQueryObj))) {
    //     //     throw new Error('Invalid filter format');
    //     // }
        
    //     delete filterQueryObj['_id']
    //     Object.entries(filterQueryObj).forEach(([key, value])=> {
    //         queryObj[key] = filterQueryObj[key]
    //     })
    //     console.log(queryObj)
          
    // }

    // search
    if (req.query.search) {
        // queryObj.$or = [{name: {$regex: req.query.search, $options: 'i'} },{description: { $regex: req.query.search, $options: 'i' }}]
        queryObj.$text = { $search: req.query.search }
    }

    // Finding resource
    query = model.find(queryObj);

   

    if (!query) {
        throw new CustomError.NotFoundError("No data found")
    }
    // population
    if (population) {
        population.forEach(populate => {
            query = query.populate(...populate);
        })
    }

    // Select Fields
    if (req.query.select) {
        const fields = req.query.select.split(',').join(' ');
        query = query.select(fields);
    }
    // else {
    //     query = query.select('-__v');
    // }

    // Sort
    if (req.query.sort) {
        const sortParams = req.query.sort.split(',');
        const sortBy = {};

        sortParams.forEach((param) => {
            const [field, order] = param.split(':');
            sortBy[field] = order === 'desc' ? -1 : 1
        });

        query = query.sort(sortBy);
    }

    // Pagination
    const limit = req.query.limit * 1 || 25;
    if (req.query.cursor) {
        let cursorQueryObk={}
        cursorQueryObk._id = { $gt: req.query.cursor }
        query = query.find(cursorQueryObk).limit(limit)


    } else {

        const page = req.query.page * 1 || 1;
        const skip = (page - 1) * limit;
        query = query.skip(skip).limit(limit);
    }




    // Executing query
    let results
    // try {
        results = await query;

    // } catch {
    //     throw new CustomError.BadRequestError(`invalid query format or invalid value`);

    // }

    // get the total number of documents for offset pagination
    const total = !req.query.cursor ? await model.countDocuments(queryObj) : null;

    // prepare the next cursor for cursor-based pagination
    const nextCursor = results.length && req.query.cursor ? results[results.length - 1]._id : null;


    return {
        success: true,
        count: results.length,
        total, //only for offset pagination
        pages: !req.query.cursor ? (Math.ceil(total / limit) === 0 && results.length ? 1 : Math.ceil(total / limit)) : undefined, //only for offset pagination
        currentPage: !req.query.cursor ? req.query.page * 1 || 1 : undefined, //only for offset pagination
        nextCursor, //only for for cursor-based pagination
        data: results
    };
};

module.exports = apiFeatures;
