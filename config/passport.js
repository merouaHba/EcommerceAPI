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
        const {
            email,
            given_name: firstname,
            family_name: lastname,
            picture: profilePicture
        } = profile._json;

        let role = 'user';
        let redirect = 'login';
        try {
            if (req.query.state) {
                const stateData = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
                role = stateData.role;
                redirect = stateData.redirect;
            }
        } catch (error) {
            console.error('Error parsing state:', error);
            role = 'user';
        }
        
                    if (await User.countDocuments({}) === 0) {
                        role = 'admin';
                    }


        let user = await User.findOne({ googleId: profile.id });
        if (!user && email) {
            user = await User.findOne({ email: email });
        }

        if (user) {
            if (user.role !== role) {
                return done(null, false, {
                    message: `Authentification failed.`,
                    redirect: redirect
                });
            }

            if (user.isBlocked) {
                return done(null, false, {
                    message: "This account has been blocked.",
                    redirect: redirect
                });
            }

            if (!user.isVerified) {
                userExists.isVerified = true;
                userExists.verified = Date.now();
                userExists.verificationToken = undefined;
                userExists.vericationTokenExpirationDate = undefined;
            }
            if (!user.email && email) {
                user.email = email;
            }
            if (!user.facebookId && profile.id) {
                user.facebookId = profile.id;
            }
            await user.save();
        } else {

            if (role === "seller") {
                return done(null, false, {
                    message: "Seller accounts cannot use Google authentication for registration",
                    redirect: redirect
                });
            }
            try {
                user = await User.create({
                    firstname: firstname || 'User',
                    lastname: lastname || '',
                    email,
                    profilePicture: {
                        url: profilePicture || ''
                    },
                    googleId: profile.id,
                    role,
                    isVerified: true,
                    verified: Date.now(),
                });
            } catch (createError) {
                console.error('Error creating user:', createError);
                return done(null, false, {
                    message: "Failed to create new user account",
                    redirect:redirect
                });
            }
        }

        if (!user) {
            return done(null, false, {
                message: "Failed to process user account",
                redirect: redirect
            });
        }

        return done(null, user);

    } catch (error) {
        console.error('Authentication error:', error);
        return done(null, false, {
            message: error.message || "Authentication failed. Please try again.",
            redirect: redirect
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
        const {
            email,
            first_name: firstname,
            last_name: lastname,
        } = profile._json;
        const profilePicture = profile.photos[0].value

        let role = 'user';
        let redirect = 'login';
        try {
            if (req.query.state) {
                const stateData = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
                role = stateData.role;
                redirect = stateData.redirect;
            }
        } catch (error) {
            console.error('Error parsing state:', error);
            role = 'user';
        }

        if (await User.countDocuments({}) === 0) {
            role = 'admin';
        }


        let user = await User.findOne({ facebookId: profile.id });
        if (!user && email) {
            user = await User.findOne({ email: email });
        }

        if (user) {
            if (user.role !== role) {
                return done(null, false, {
                    message: `Authentification failed.`,
                    redirect
                });
            }

            if (user.isBlocked) {
                return done(null, false, {
                    message: "This account has been blocked.",
                    redirect
                });
            }

            if (!user.isVerified) {
                userExists.isVerified = true;
                userExists.verified = Date.now();
                userExists.verificationToken = undefined;
                userExists.vericationTokenExpirationDate = undefined;
            }
            if (!user.email && email) {
                user.email = email;
            }
            if (!user.facebookId && profile.id) {
                user.facebookId = profile.id;
            }
            await user.save();
        } else {

            if (role === "seller") {
                return done(null, false, {
                    message: "Seller accounts cannot use Facebook authentication for registration",
                    redirect
                });
            }
            try {
                user = await User.create({
                    firstname: firstname || 'User',
                    lastname: lastname || '',
                    email,
                    profilePicture: {
                        url: profilePicture || ''
                    },
                    facebookId: profile.id,
                    role,
                    isVerified: true,
                    verified: Date.now(),
                });
            } catch (createError) {
                console.error('Error creating user:', createError);
                return done(null, false, {
                    message: "Failed to create new user account",
                    redirect
                });
            }
        }

        if (!user) {
            return done(null, false, {
                message: "Failed to process user account",
                redirect
            });
        }

        return done(null, user);

    } catch (error) {
        console.error('Authentication error:', error);
        return done(null, false, {
            message: error.message || "Authentication failed. Please try again.",
            redirect
        });
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