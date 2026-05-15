import mongoose from "mongoose";
import dotenv from "dotenv";
import colors from "colors";
import { exit } from "node:process";

dotenv.config();

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.DATABASE_URL);
        console.log(colors.cyan.bold(`MongoDB Conectado: ${conn.connection.host}`));
        
    } catch (error) {
        console.log(colors.bgRed.bold('Error en la conexion a MongoDB'));
        console.log(colors.red.bold('Error al conectar a MongoDB'));
        exit(1);
    }
}
export default connectDB;