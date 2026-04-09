import swaggerJSDoc from 'swagger-jsdoc';
import { RoleNameValues } from '../types/role.js';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Video Platform API (TS)',
    version: '1.0.0',
    description: 'TypeScript backend API documentation'
  },
  servers: [{ url: 'http://localhost:4000' }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    },
    schemas: {
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', example: 'admin@pulsegen.io' },
          password: { type: 'string', example: 'admin' }
        }
      },
      CreateUserRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', example: 'editor@pulsegen.io' },
          password: { type: 'string', example: 'secret123' },
          tenantId: { type: 'string', example: '67f673cc947f6074ff4285e6' },
          roleId: { type: 'string', example: '67f673cc947f6074ff4285e7' },
          roleName: {
            type: 'string',
            enum: RoleNameValues,
            example: 'editor'
          },
          isActive: { type: 'boolean', example: true }
        }
      },
      CreateTenantRequest: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', example: 'Pulse' },
          slug: { type: 'string', example: 'pulse' },
          status: { type: 'string', enum: ['active', 'suspended', 'archived'], example: 'active' }
        }
      },
      UpdateTenantRequest: {
        type: 'object',
        properties: {
          name: { type: 'string', example: 'Pulse Updated' },
          slug: { type: 'string', example: 'pulse-updated' },
          status: { type: 'string', enum: ['active', 'suspended', 'archived'], example: 'suspended' }
        }
      }
    }
  },
  paths: {
    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        responses: {
          200: { description: 'Service is healthy' }
        }
      }
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login user and get access token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' }
            }
          }
        },
        responses: {
          200: { description: 'Login successful' },
          400: { description: 'email and password are required' },
          401: { description: 'Invalid email or password' },
          403: { description: 'User account is inactive' },
          500: { description: 'User role is not configured' }
        }
      }
    },
    '/api/users': {
      post: {
        tags: ['Users'],
        summary: 'Create user (admin and super-admin)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateUserRequest' }
            }
          }
        },
        responses: {
          201: { description: 'User created' },
          400: { description: 'Validation error' },
          401: { description: 'Missing or invalid token' },
          403: { description: 'Insufficient clearance' },
          404: { description: 'Tenant not found' },
          409: { description: 'User already exists' }
        }
      }
    },
    '/api/tenants': {
      get: {
        tags: ['Tenants'],
        summary: 'Get tenants (super-admin only)',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Tenants fetched' },
          401: { description: 'Missing or invalid token' },
          403: { description: 'Insufficient clearance' }
        }
      },
      post: {
        tags: ['Tenants'],
        summary: 'Create tenant (super-admin only)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateTenantRequest' }
            }
          }
        },
        responses: {
          201: { description: 'Tenant created' },
          400: { description: 'Validation error' },
          401: { description: 'Missing or invalid token' },
          403: { description: 'Insufficient clearance' },
          409: { description: 'Tenant slug already exists' }
        }
      }
    },
    '/api/tenants/{tenantId}': {
      patch: {
        tags: ['Tenants'],
        summary: 'Update tenant (super-admin only)',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'path',
            name: 'tenantId',
            required: true,
            schema: { type: 'string' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateTenantRequest' }
            }
          }
        },
        responses: {
          200: { description: 'Tenant updated' },
          400: { description: 'Validation error' },
          401: { description: 'Missing or invalid token' },
          403: { description: 'Insufficient clearance' },
          404: { description: 'Tenant not found' },
          409: { description: 'Tenant slug already exists' }
        }
      },
      delete: {
        tags: ['Tenants'],
        summary: 'Delete tenant (super-admin only)',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'path',
            name: 'tenantId',
            required: true,
            schema: { type: 'string' }
          }
        ],
        responses: {
          200: { description: 'Tenant deleted' },
          400: { description: 'Invalid tenantId' },
          401: { description: 'Missing or invalid token' },
          403: { description: 'Insufficient clearance' },
          404: { description: 'Tenant not found' }
        }
      }
    }
  }
};

const swaggerSpec = swaggerJSDoc({
  definition: swaggerDefinition,
  apis: []
});

export default swaggerSpec;
