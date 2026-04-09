import swaggerJSDoc from 'swagger-jsdoc';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Video Platform API (TS)',
    version: '1.0.0',
    description: 'TypeScript backend scaffold API docs'
  },
  servers: [{ url: 'http://localhost:4000' }]
};

const swaggerSpec = swaggerJSDoc({
  definition: swaggerDefinition,
  apis: []
});

export default swaggerSpec;
