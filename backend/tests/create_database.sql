SELECT 'CREATE DATABASE college_finder_test'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'college_finder_test')
\gexec
