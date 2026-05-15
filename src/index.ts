//File: backend/src/index.ts

import colors from 'colors'
import server from './server'

const port = process.env.PORT || 4000

server.listen(port, () => {
    console.log( colors.bgMagenta.bold( `REST API in the PORT: ${port}`))
})