"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
    }));
    const port = process.env.PORT ?? 3000;
    await app.listen(port);
    console.log(`\n🚀 Application is running on: http://localhost:${port}\n`);
}
bootstrap();
//# sourceMappingURL=main.js.map