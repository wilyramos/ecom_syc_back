// middlewares/upload.ts
import multer from 'multer';
import path from 'path';
import os from 'os';

const upload = multer({
    dest: path.join(os.tmpdir()), // Carpeta temporal
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

export default upload;
