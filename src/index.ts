// backend/src/index.ts
import colors from 'colors'
import server from './server'

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    process.exit(1);
});

const port = process.env.PORT || 4000

const serverInstance = server.listen(port, () => {
    console.log(colors.bgMagenta.bold(`REST API in the PORT: ${port}`));
})

process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err);
    serverInstance.close(() => {
        process.exit(1);
    });
});