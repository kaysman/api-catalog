import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ApiCatalogAdapter } from 'api-catalog/nestjs';
import { s } from 'api-catalog/spec';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  ApiCatalogAdapter.setup('/docs', app, {
    title: 'Users API',
    version: '1.0.0',
    schemas: {
      User: s.object(
        {
          id:    s.string({ format: 'uuid' }),
          name:  s.string(),
          email: s.string({ format: 'email' }),
          role:  s.enum(['admin', 'user']),
        },
        ['id', 'name', 'email', 'role'],
      ),
    },
  });

  await app.listen(3000);

  console.log('Server:  http://localhost:3000');
  console.log('Catalog: http://localhost:3000/docs');
}

bootstrap();
