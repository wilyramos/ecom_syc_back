//File: src/server.ts

import express from 'express'
import morgan from 'morgan'
import connectDB from './config/db'
import dotenv from 'dotenv'
import authRouter from './routes/authRouter'
import productRouter from './routes/productRouter'
import categoryRouter from './routes/categoryRouter'
import cartRouter from './routes/cartRouter'
import orderRouter from './routes/orderRouter'
import checkoutRouter from './routes/checkoutRouter'
import saleRouter from './routes/saleRouter'
import webhookRouter from './routes/webhookRouter'
import userRouter from './routes/userRouter'
import purchaseRouter from './routes/purchaseRouter'
import brandRouter from './routes/brandRouter'

//Cors
import cors from 'cors'
import { globalErrorHandler } from './middleware/error.middleware'
import lineRouter from './routes/line.router'


// v2
import productRouterV2 from './modules/product/product.routes'
import saleRouterV2 from './modules/sale/sale.routes'
import cashRouter from './modules/cash/cash.routes'
import reportRouter from './modules/reports/report.routes'
import sliderBannerRouter from './modules/sliderbanner/sliderbanner.routes'

import setupSwagger from './config/swagger.config'

dotenv.config()

const app = express()

connectDB()

app.use(morgan('dev'))
app.use(express.json())

// Cors
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}))

app.get('/', (req, res) => {
    res.send('API is running...')
})

setupSwagger(app)


// Version 2.0: Refactor to use controllers and services for products and sales
app.use('/api/products/v2', productRouterV2)
app.use('/api/sales/v2', saleRouterV2)
app.use('/api/cash/v2', cashRouter)
app.use('/api/reports/v2', reportRouter)
app.use('/api/slider-banners', sliderBannerRouter)

// Routers
app.use('/api/auth', authRouter)
app.use('/api/users', userRouter)
app.use('/api/category', categoryRouter)
app.use('/api/brands', brandRouter)
app.use('/api/products', productRouter)
app.use('/api/cart', cartRouter)
app.use('/api/orders', orderRouter)
app.use('/api/checkout', checkoutRouter)
app.use('/api/sales', saleRouter)
app.use('/api/lines', lineRouter)
app.use('/api/webhooks',
    express.urlencoded({ extended: true }),
    webhookRouter
),
    app.use('/api/purchases', purchaseRouter)

//


// Middleware global for error handling 
app.use(globalErrorHandler);



export default app