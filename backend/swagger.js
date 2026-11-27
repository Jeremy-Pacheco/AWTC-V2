const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AWTC API',
      version: '1.0.0',
      description: [
        'API Documentation for A Will To Change.',
        '',
        '**How to authorize:** get an `access_token` and paste it in **Authorize** (bearerAuth).',
        '- Public demo: `POST /api/demo/login` with `{ "role": "volunteer" | "coordinator" | "admin" }`.',
        '- Any environment: `POST /api/users/login` with your email and password.',
        '',
        'Access tokens last 15 minutes; log in again (or use `/api/auth/refresh` from the app) when it expires.',
      ].join('\n'),
      contact: {
        name: 'AWTC Support'
      }
    },
    // The current server comes first so "Try it out" works on the deployed
    // docs (e.g. https://awtc-api.jeremypacheco.es/api-docs) without changes.
    servers: [
      {
        url: '/',
        description: 'This server'
      },
      {
        url: 'http://localhost:8080',
        description: 'Local development server'
      }
    ],
    security: [
      {
        bearerAuth: []
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        },
        basicAuth: {
          type: 'http',
          scheme: 'basic'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            name: { type: 'string', example: 'Jane Doe' },
            email: { type: 'string', format: 'email', example: 'user@example.com' },
            role: { type: 'string', enum: ['volunteer', 'coordinator', 'admin'], example: 'volunteer' },
            profileImage: { type: 'string', nullable: true, example: 'profile.png' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Project: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            name: { type: 'string', example: 'Project Name' },
            description: { type: 'string' },
            start_date: { type: 'string', format: 'date-time' },
            end_date: { type: 'string', format: 'date-time' },
            location: { type: 'string', example: 'Las Palmas de Gran Canaria' },
            capacity: { type: 'integer', example: 20 },
            filename: { type: 'string', nullable: true, description: 'Project image' },
            categoryId: { type: 'integer', example: 1 },
            ownerId: { type: 'integer', nullable: true, description: 'Coordinator who manages the project' },
            status: { type: 'string', enum: ['active', 'cancelled', 'finished'] },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Category: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            name: { type: 'string', example: 'Education' },
            description: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Review: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            content: { type: 'string', example: 'Great experience volunteering here!' },
            date: { type: 'string', format: 'date-time' },
            image: { type: 'string', nullable: true, example: '/images/review-image.jpg' },
            userId: { type: 'integer', example: 1 },
            user: {
              type: 'object',
              properties: {
                id: { type: 'integer', example: 1 },
                name: { type: 'string', example: 'Admin' },
                email: { type: 'string', format: 'email', example: 'admin@awtc.es' }
              }
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Contact: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            subject: { type: 'string' },
            message: { type: 'string' },
            read: { type: 'boolean', example: false },
            createdAt: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  },
  // Every route file, resolved from this file so it works from any cwd
  // (glob patterns need forward slashes, also on Windows)
  apis: [path.join(__dirname, 'routes', '*.js').split(path.sep).join('/')]
};

const swaggerSpecs = swaggerJsdoc(options);

module.exports = swaggerSpecs;
