const passport = require('passport');
const User = require('../models/userModel');
const { ForbiddenError } = require('../errors');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const AppleStrategy = require('passport-apple').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const baseURL = process.env.BASE_URL 
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${baseURL}/auth/google/callback`,
    accessType: 'offline',
    prompt: 'consent',
    passReqToCallback: true
}, async (req, accessToken, refreshToken, profile, done) => {
    try {
        // Extract user info from profile
        const {
            email,
            given_name: firstname,
            family_name: lastname,
            picture: profilePicture
        } = profile._json;

        // Determine user role
        let role = 'user';
        try {
            if (req.query.state) {
                const stateData = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
                role = stateData.role;
            }

            // Check if first account (make admin)
            if (await User.countDocuments({}) === 0) {
                role = 'admin';
            }
        } catch (error) {
            console.error('Error parsing state:', error);
            // Default to user role if state parsing fails
            role = 'user';
        }

        // Early check for seller role
        if (role === "seller") {
            return done(null, false, {
                message: "Seller accounts cannot use Google authentication"
            });
        }

        // Find existing user
        let user = await User.findOne({
            $or: [
                { googleId: profile.id },
                { email: email }
            ]
        });

        if (user) {
            // Validate role
            if (user.role !== role) {
                return done(null, false, {
                    message: `This account is registered as ${user.role}. Please use the correct login portal.`
                });
            }

            // Check if blocked
            if (user.isBlocked) {
                return done(null, false, {
                    message: "This account has been blocked."
                });
            }

            // Update user information
            try {
                user = await User.findByIdAndUpdate(
                    user._id,
                    {
                        $set: {
                            isVerified: true,
                            verified: Date.now(),
                            verificationToken: undefined,
                            verificationTokenExpirationDate: undefined,
                            email: email || user.email,
                            googleId: profile.id,
                            lastLogin: Date.now()
                        }
                    },
                    {
                        new: true,
                        runValidators: true
                    }
                );

                if (!user) {
                    throw new Error('User update failed');
                }
            } catch (updateError) {
                console.error('Error updating user:', updateError);
                return done(null, false, {
                    message: "Failed to update user information"
                });
            }
        } else {
            // Create new user
            try {
                user = await User.create({
                    firstname: firstname || 'User',
                    lastname: lastname || '',
                    email,
                    profilePicture: {
                        url: profilePicture || '',
                        updatedAt: Date.now()
                    },
                    googleId: profile.id,
                    role,
                    isVerified: true,
                    verified: Date.now(),
                    lastLogin: Date.now(),
                    accountType: 'google'
                });
            } catch (createError) {
                console.error('Error creating user:', createError);
                return done(null, false, {
                    message: "Failed to create new user account"
                });
            }
        }

        // Final validation check
        if (!user) {
            return done(null, false, {
                message: "Failed to process user account"
            });
        }

        return done(null, user);

    } catch (error) {
        console.error('Authentication error:', error);
        return done(null, false, {
            message: error.message || "Authentication failed. Please try again."
        });
    }
}));

passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: `${baseURL}/auth/facebook/callback`,
    profileFields: ['id', 'email','displayName', 'name', 'picture'],
    enableProof: true,
    passReqToCallback: true
}, async (req, accessToken, refreshToken, profile, done) => {
    try {
        const isFirstAccount = (await User.countDocuments({})) === 0;
        let role = 'user';

        if (req.query.state) {
            const stateData = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
            role = stateData.role;
        }
        if (isFirstAccount) role = 'admin';
        const userInfo = profile._json;

        let user = await User.findOne({ facebookId: profile.id });
        if (!user && userInfo.email) {
            user = await User.findOne({ email:userInfo.email });
        }
       

       

        if (user) {
            if (user.role !== role) {
                return   done(new ForbiddenError(`This account is registred as a ${user.role}. Please Log in through the correct portal`)
, null)

            }
            if (user.isBlocked) {
                return done(new ForbiddenError(`This account is Blocked.`), null)
            }
            if (!user.isVerified) {
                userExists.isVerified = true;
                userExists.verified = Date.now();
                userExists.verificationToken = undefined;
                userExists.vericationTokenExpirationDate = undefined;
            }
            if (!user.email && userInfo.email) {
                user.email = userInfo.email;
            }
            if (!user.facebookId && profile.id) {
                user.facebookId = profile.id;
            }
            await user.save();
        } else {
            if (role === "seller") {
                return done(new BadRequestError("this role can't connect with this feature"), null)
            }
            user = await User.create({
                firstname: userInfo.first_name || 'User',
                lastname: userInfo.last_name || "",
                email: userInfo.email,
                profilePicture: { url: profile.photos[0].value || '' },
                facebookId: profile.id,
                role,
                isVerified: true,
                verificationToken : undefined ,
                vericationTokenExpirationDate : undefined,
                verified : Date.now()
            });
            await user.save();
        }

        return done(null,user);
    } catch (error) {
        return done(error, null);
    }
}));


// passport.use(new AppleStrategy({
//     clientID: "",
//     teamID: "",
//     callbackURL: `${baseURL}/auth/google/callback`,
//     keyID: "",
//     privateKeyLocation: "",
//     passReqToCallback: true
// }, function (req, accessToken, refreshToken, idToken, profile, cb) {
//     // The idToken returned is encoded. You can use the jsonwebtoken library via jwt.decode(idToken)
//     // to access the properties of the decoded idToken properties which contains the user's
//     // identity information.
//     // Here, check if the idToken.sub exists in your database!
//     // idToken should contains email too if user authorized it but will not contain the name
//     // `profile` parameter is REQUIRED for the sake of passport implementation
//     // it should be profile in the future but apple hasn't implemented passing data
//     // in access token yet https://developer.apple.com/documentation/sign_in_with_apple/tokenresponse
//     cb(null, idToken);
// }));