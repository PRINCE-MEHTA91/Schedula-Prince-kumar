"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    const port = process.env.PORT ?? 3000;
    await app.listen(port);
    console.log(`\n🚀 Schedula API is running on: http://localhost:${port}`);
    console.log(`📋 Available endpoints:`);
    console.log(`   POST http://localhost:${port}/auth/signup`);
    console.log(`   POST http://localhost:${port}/auth/login`);
    console.log(`   GET  http://localhost:${port}/doctor/profile  [DOCTOR only]`);
    console.log(`   GET  http://localhost:${port}/patient/profile [PATIENT only]\n`);
}
bootstrap();
//# sourceMappingURL=main.js.map