import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import { users, settings } from '../db/schema';
import { eq } from 'drizzle-orm';
import { env } from './env';

passport.use(
  new LocalStrategy(
    { usernameField: 'email' },
    async (email, password, done) => {
      try {
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email.toLowerCase()))
          .limit(1);

        if (!user || !user.passwordHash) {
          return done(null, false, { message: 'Invalid credentials' });
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          return done(null, false, { message: 'Invalid credentials' });
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: env.GOOGLE_CALLBACK_URL,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(new Error('No email from Google profile'));
          }

          // Check if user already exists
          const [existingUser] = await db
            .select()
            .from(users)
            .where(eq(users.email, email.toLowerCase()))
            .limit(1);

          if (existingUser) {
            // Link Google ID if not already linked
            if (!existingUser.googleId) {
              await db
                .update(users)
                .set({ googleId: profile.id })
                .where(eq(users.id, existingUser.id));
            }
            return done(null, existingUser);
          }

          // Create new user
          const [newUser] = await db
            .insert(users)
            .values({
              email: email.toLowerCase(),
              googleId: profile.id,
              name: profile.displayName || email.split('@')[0],
              avatarUrl: profile.photos?.[0]?.value,
            })
            .returning();

          // Create default settings
          await db.insert(settings).values({ userId: newUser.id });

          return done(null, newUser);
        } catch (err) {
          return done(err as Error);
        }
      }
    )
  );
}

export default passport;
