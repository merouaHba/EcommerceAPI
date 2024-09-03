// Utils
const CustomError = require('../errors');




// aggregation
// const apiFeatures = async (req, model, lookups, exclude) => {
//     let pipline = []
//     let queryObj = {}
    
//     // search
//     if (req.query.search) {
//         // queryObj.$or = [{name: {$regex: req.query.search, $options: 'i'} },{description: { $regex: req.query.search, $options: 'i' }}]
//         queryObj.$text = { $search: req.query.search }
//         pipline.push({
//             $match: {
//                 $text: { $search: req.query.search }
//             }
//         })
//     }
  
//     // remove fields
//     const fieldsToRemove = {}
//     let fieldsToExclude = ['__v']
//     if (exclude) {
//         fieldsToExclude = [...fieldsToExclude, ...exclude]
//     }
//     fieldsToExclude.forEach((field) => {
//         fieldsToRemove[field] = 0
//     })
//     pipline.push({
//         $project: fieldsToRemove
//     })

//     // Copy req.query
//     const reqQuery = { ...req.query };
    
//     // Fields to exclude
//     const removeFields = ['select', 'sort', 'page', 'limit', 'filter', 'search', 'cursor'];
    
//     // filter

//     // Loop over removeFields and delete them from reqQuery
//     removeFields.forEach((param) => delete reqQuery[param]);

//     // // delete _id from query
//     // delete reqQuery['_id']

//     // Create query string
//     let queryStr = JSON.stringify(reqQuery);

//     // Create operators ($gt, $gte, etc)
//     queryStr = queryStr.replace(
//         /\b(gt|gte|lt|lte|in|ne|eq)\b/g,
//         (match) => `$${match}`
//     );
//     queryObj = JSON.parse(queryStr)
   
//     Object.entries(queryObj).forEach(([key, value]) => {

//         if (typeof value === 'string') {
            
//             if (!isNaN(value) && value.trim() !== '') {
//             queryObj[key] = parseFloat(value)
//             }
//             if (value.trim().toLowerCase() === 'true') {
//                 queryObj[key] = true
//             } else if (value.trim().toLowerCase() === 'false') {
//                 queryObj[key] = false
//             }

//         } else {
//             // obj
//             Object.entries(value).forEach(([k, val]) => {

//                 if (typeof val === 'string') {

//                     if (!isNaN(val) && val.trim() !== '') {
//                         value[k] = parseFloat(val)
//                     }
//                     if (k === '$in') {
//                         value[k] = val.split(',').map((v) => {
//                             if (!isNaN(v) && v.trim() !== '') {
//                                 return parseFloat(v)
//                             }
                                
//                                 return v
                            
//                         })
//                     }
                   

//                 } else {
//                     // obj
//                 }
//             })
//         }
//  })




//     pipline.push({
//         $match: queryObj
//     })
// console.log(queryObj)


  
  


//     // Select Fields
//     if (req.query.select) {
//         const fields = { }
//           req.query.select.split(',').forEach(field => {
//               fields[field] = 1
//         })
        
//         pipline.push({
//             $project: fields
//         })
//     }

//     // Sort
//     if (req.query.sort) {
//         const sortParams = req.query.sort.split(',');
//         const sortBy = {};

//         sortParams.forEach((param) => {
//             const [field, order] = param.split(':');
//             sortBy[field] = order === 'desc' ? -1 : 1
//         });

//         // query = query.sort(sortBy);
//         pipline.push({
//             $sort: sortBy
//         })
//     }
//     // population
//     if (lookups) {
//         lookups.forEach(([from, localField, as, excludeFrom]) => {
//             // query = query.populate(...populate);
//             pipline.push({
//                 $lookup: {
//                     from,
//                     localField,
//                     foreignField: '_id',
//                     as
//                 }
//             })
//             pipline.push({
//                 $unwind: `$${as}`
//             })
//             const fieldsToRemove = {}
//             let fieldsToExcludeFrom = ['__v']
//             if (excludeFrom) {
//                 fieldsToExcludeFrom = [...fieldsToExcludeFrom, ...excludeFrom]
//             }
//             fieldsToExcludeFrom.forEach((field) => {
//                 fieldsToRemove[`${as}.${field}`] = 0
//             })


//             pipline.push({
//                 $project: fieldsToRemove
//             })

//         })
//     }
//     // Pagination
//     let results

//     const limit = req.query.limit * 1 || 25;
//     if (req.query.cursor) {
//         let cursor

//         try {
//             cursor = new mongoose.Types.ObjectId(req.query.cursor)
//             pipline.push({
//                 $facet: {
//                     documents: [
                        
//                        { $match: {
//                             _id: { $gt: cursor }
//                         }},
//                         {$limit: limit}
//                     ],
//                     totalCount: [
//                         {$count:'count'}
//                     ]
//                 }
//             })
//             pipline.push({
//                 $project: {
//                     documents: 1,
//                     totalCount: { $arrayElemAt: ["$totalCount.count",0]}
//                 }
//             })
//             // pipline.push({
//             //     $limit: limit
//             // })
//             // Executing query
//             try {
//                 results = await model.aggregate(pipline);

//             } catch {
//                 throw new CustomError.BadRequestError(`invalid query format or invalid value`);

//             }
//         } catch (error) {
//             results = []

//         }
//         // queryObj._id = { $gt: req.query.cursor }
//         // query = query.find(queryObj).limit(limit)
    

//     } else {

//         const page = req.query.page * 1 || 1;
//         const skip = (page - 1) * limit;

//         // pipline.push({
//         //     $skip: skip
//         // })
//         // pipline.push({
//         //     $limit: limit
//         // })

//         pipline.push({
//             $facet: {
//                 documents: [

//                     {
//                         $skip: skip
//                     },
//                     { $limit: limit }
//                 ],
//                 totalCount: [
//                     { $count: 'count' }
//                 ]
//             }
//         })
//         pipline.push({
//             $project: {
//                 documents: 1,
//                 totalCount: { $arrayElemAt: ["$totalCount.count", 0] }
//             }
//         })

//         // Executing query
//         try {
//             console.log("pipline")
//             console.log(pipline)
//             results = await model.aggregate(pipline);

//         } catch(err) {
// console.log(err)
//             throw new CustomError.BadRequestError(`invalid query format or invalid value`);

//         }
//     }




// // console.log("########################################")
// // console.log(results)
// console.log("########################################")
// results=results[0]

//     // get the total number of documents for offset pagination
//     console.log(queryObj)
//     const total = !req.query.cursor ? results.totalCount : null;
// // console.log(total)
//     // prepare the next cursor for cursor-based pagination
//     const nextCursor = results.documents.length ? results.documents[results.documents.length - 1]._id : null;


//     return {
//         success: true,
//         count: results.documents?.length, // count of documents for this page
//         total: !req.query.cursor ? total: undefined, //only for offset pagination
//         pages: !req.query.cursor ? (Math.ceil(total / limit) == 0 && results.totalCount ? 1 : Math.ceil(total / limit)): undefined, //only for offset pagination
//         currentPage: !req.query.cursor ? (results.documents.length?  req.query.page * 1 || 1:0 ): undefined, //only for offset pagination
//         nextCursor: req.query.cursor  ? nextCursor : undefined, //only for for cursor-based pagination
//         data: results.documents
//     };
// };

const apiFeatures = async (req, model, lookups, exclude) => {
    let pipline = []
    // population
    if (lookups) {
        lookups.forEach(([from, localField, as, excludeFrom]) => {
            // query = query.populate(...populate);
            pipline.push({
                $lookup: {
                    from,
                    localField,
                    foreignField: '_id',
                    as
                }
            })
            pipline.push({
                $unwind: `$${as}`
            })
            //     const fieldsToRemove = {}
            // let fieldsToExcludeFrom = ['__v']
            // if (excludeFrom) {
            //     fieldsToExcludeFrom = [...fieldsToExcludeFrom, ...excludeFrom]
            // }
            //    fieldsToExcludeFrom.forEach((field) => {
            //         fieldsToRemove[`${as}.${field}`]=0
            //     })


            //     pipline.push({
            //         $project: fieldsToRemove
            //     })

        })
    }
    // remove fields
    // const fieldsToRemove = {}
    // let fieldsToExclude = ['__v']
    // if (exclude) {
    //     fieldsToExclude = [...fieldsToExclude, ...exclude]
    // }
    // fieldsToExclude.forEach((field) => {
    //     fieldsToRemove[field] = 0
    // })
    // pipline.push({
    //     $project: fieldsToRemove
    // })

    // Copy req.query
    const reqQuery = { ...req.query };

    // Fields to exclude
    const removeFields = ['select', 'sort', 'page', 'limit', 'filter', 'search', 'cursor'];

    // filter

    // Loop over removeFields and delete them from reqQuery
    removeFields.forEach((param) => delete reqQuery[param]);

    // // delete _id from query 
    // delete reqQuery['_id']

    // Create query string
    let queryStr = JSON.stringify(reqQuery);

    // Create operators ($gt, $gte, etc)
    queryStr = queryStr.replace(
        /\b(gt|gte|lt|lte|in|ne|eq)\b/g,
        (match) => `$${match}`
    );
    queryObj = JSON.parse(queryStr)

    // example price[gt]=400,price[in]=400,5000 name=hp


    // filter 
    // // /items?filter={'price':{"gt":100,"lt":500},category:{in:["electronics","appliances"]}}
    // if (req.query.filter) {

    //     // Parse and transform the filter
    //     let filter
    //     try {
    //          filter = JSON.parse(req.query.filter);
    //     } catch (error) {
    //         throw new CustomError.BadRequestError('Invalid Filter Format');
    //     }

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




    pipline.push({
        $match: queryObj
    })

    // search
    if (req.query.search) {
        // queryObj.$or = [{name: {$regex: req.query.search, $options: 'i'} },{description: { $regex: req.query.search, $options: 'i' }}]
        // queryObj.$text = { $search: req.query.search }
        pipline.push({
            $match: {
                $text: { $search: req.query.search }
            }
        })
    }




    // // Finding resource
    // query = model.find(queryObj);



    // if (!query) {
    //     throw new CustomError.NotFoundError("No data found")
    // }

    // Select Fields
    const fields = {}
    if (req.query.select) {
        req.query.select.split(',').forEach(field => {
            fields[field] = 1
        })
        // query = query.select(fields);

    }
    pipline.push({
        $project: fields
    })

    // Sort
    if (req.query.sort) {
        const sortParams = req.query.sort.split(',');
        const sortBy = {};

        sortParams.forEach((param) => {
            const [field, order] = param.split(':');
            sortBy[field] = order === 'desc' ? -1 : 1
        });

        // query = query.sort(sortBy);
        pipline.push({
            $sort: sortBy
        })
    }

    // Pagination
    const limit = req.query.limit * 1 || 25;
    if (req.query.cursor) {
        // queryObj._id = { $gt: req.query.cursor }
        // query = query.find(queryObj).limit(limit)
        pipline.push({
            $match: {
                _id: { $search: req.query.search }
            }
        })
        pipline.push({
            $limit: limit
        })


    } else {

        const page = req.query.page * 1 || 1;
        const skip = (page - 1) * limit;
        // query = query.skip(skip).limit(limit);

        pipline.push({
            $skip: skip
        })
        pipline.push({
            $limit: limit
        })
    }




    // Executing query
    let results
    try {
        results = await model.aggregate(pipline);

    } catch {
        throw new CustomError.BadRequestError(`invalid query format or invalid value`);

    }

    // get the total number of documents for offset pagination
    const total = !req.query.cursor ? await model.countDocuments(queryObj) : null;

    // prepare the next cursor for cursor-based pagination
    const nextCursor = results.length ? results[results.length - 1]._id : null;


    return {
        success: true,
        count: results.length,
        total, //only for offset pagination
        pages: total ? Math.ceil(total / limit) : undefined, //only for offset pagination
        currentPage: total ? req.query.page * 1 || 1 : undefined, //only for offset pagination
        nextCursor, //only for for cursor-based pagination
        data: results
    };
};

module.exports = apiFeatures;
