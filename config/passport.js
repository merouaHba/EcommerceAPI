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
        console.log(req.query)
        const isFirstAccount = (await User.countDocuments({})) === 0;
        let role = 'user';

        if (req.query.state) {
            const stateData = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
            role = stateData.role;
        }

        if (isFirstAccount) role = 'admin';
        const userInfo = profile._json;

        let user = await User.findOne({ googleId: profile.id });
        if (!user && userInfo.email) {
            user = await User.findOne({ email: userInfo.email });
        }


        if (user) {
            if (user.role !== role) {
                throw new ForbiddenError(`This account is registred as a ${user.role}. Please Log in through the correct portal`)

            }
            if (user.isBlocked) {
                throw new BadRequestError('Account is Blocked.')
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
            if (!user.googleId && profile.id ) {
                user.googleId = profile.id;
            }
            await user.save();
        } else {
            user = await User.create({
                firstname: userInfo.given_name || 'User',
                lastname: userInfo.family_name || '',
                email: userInfo.email,
                profilePicture: { url: userInfo.picture || '' },
                googleId: profile.id,
                role,
                isVerified: true,
                verificationToken: undefined,
                vericationTokenExpirationDate: undefined,
                verified: Date.now()
            });
        }

        return done(null, user);
    } catch (error) {
        return done(error, null);
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
        console.log(accessToken, refreshToken, profile)
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
                throw new ForbiddenError(`This account is registred as a ${user.role}. Please Log in through the correct portal`)

            }
            if (user.isBlocked) {
                throw new BadRequestError('Account is Blocked.')
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