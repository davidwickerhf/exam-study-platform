// Load only the caller-authorized environment, then explicitly isolate storage
// before importing any application module that initializes the database client.
delete process.env.DATABASE_URL
await import('./study-course-suite.mjs')
