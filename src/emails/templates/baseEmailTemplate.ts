type EmailTemplateParams = {
	title: string;
	content: string;
};

export function baseEmailTemplate({ title, content }: EmailTemplateParams): string {
	return `
  <!DOCTYPE html>
  <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; background: #ffffff; color: #333333; margin:0; padding:20px;">
      <div style="max-width:600px; margin:0 auto;">
        <div style="text-align:center; padding:20px 0;">
          <img src="https://www.gophone.pe/logo.png" alt="GoPhone Logo" style="max-width:120px; height:auto;" />
        </div>
        <h1 style="font-size:20px; text-align:center; margin:20px 0;">${title}</h1>
        <div style="font-size:14px; line-height:1;">
          ${content}
        </div>
        <div style="margin-top:30px; font-size:12px; text-align:center; color:#666;">
          © ${new Date().getFullYear()} Gophone.pe<br/>
          Este mensaje fue enviado automáticamente. No respondas a este correo.
        </div>
      </div>
    </body>
  </html>
  `;
}
