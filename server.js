const express = require('express');
const app = express();

// Parse JSON bodies
app.use(express.json());

class NotFoundError extends Error {
  constructor(message = 'Not Found') {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

class ValidationError extends Error {
  constructor(message = 'Validation Error') {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
    this.statusCode = 401;
  }
}

const logger = (req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
};
app.use(logger);


// Middleware to parse JSON request bodies
app.use(express.json());

// Sample in-memory "database" (array of product objects)
const products = [
  {
    id: 1,
    name: "Laptop",
    description: "15-inch display, 16GB RAM, 512GB SSD",
    price: 18999.99,
    category: "Electronics",
    inStock: true
  },
  {
    id: 2,
    name: "Wireless Mouse",
    description: "Ergonomic design with USB receiver",
    price: 399.99,
    category: "Accessories",
    inStock: true
  }
];

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// -----------------------------
// ROUTES
// -----------------------------

// Using the products array that was already defined above

// ----- Product Data -----
products = [
  { id: 1, name: 'Laptop', description: '15-inch screen', price: 18999.99, category: 'Electronics', inStock: true },
  { id: 2, name: 'Mouse', description: 'Wireless mouse', price: 399.99, category: 'Accessories', inStock: true },
  { id: 3, name: 'Keyboard', description: 'Mechanical RGB keyboard', price: 1299.99, category: 'Accessories', inStock: true },
  { id: 4, name: 'Headphones', description: 'Noise cancelling', price: 2599.99, category: 'Electronics', inStock: false },
  { id: 5, name: 'Monitor', description: '27-inch display', price: 3499.99, category: 'Electronics', inStock: true },
];


// GET /api/products - List all products

// GET /api/products - with filtering and pagination
app.get('/api/products', asyncHandler(async (req, res) => {
  let results = [...products];

  // Filter by category
  if (req.query.category) {
    results = results.filter(p => p.category.toLowerCase() === req.query.category.toLowerCase());
  }

  // Pagination
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 2; // Default: 2 items per page
  const start = (page - 1) * limit;
  const end = start + limit;

  const paginated = results.slice(start, end);
  const totalPages = Math.ceil(results.length / limit);

  res.json({
    page,
    limit,
    totalPages,
    totalItems: results.length,
    products: paginated
  });
}));

// GET /api/products/search?name=keyword
app.get('/api/products/search', asyncHandler(async (req, res, next) => {
  const { name } = req.query;
  if (!name) return next(new ValidationError('Please provide a search keyword'));

  const results = products.filter(p =>
    p.name.toLowerCase().includes(name.toLowerCase())
  );

  if (results.length === 0) throw new NotFoundError('No products match your search');

  res.json({ count: results.length, results });
}));


// GET /api/products/:id - Get a specific product by ID
app.get('/api/products/:id', (req, res) => {
  const product = products.find(p => p.id === parseInt(req.params.id));
  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }
  res.json(product);
});

// POST /api/products - Create a new product
app.post('/api/products', (req, res) => {
  const newProduct = {
    id: products.length ? products[products.length - 1].id + 1 : 1,
    name: req.body.name,
    description: req.body.description,
    price: req.body.price,
    category: req.body.category,
    inStock: req.body.inStock
  };
  
  products.push(newProduct);
  res.status(201).json(newProduct);
});

// PUT /api/products/:id - Update an existing product
app.put('/api/products/:id', (req, res) => {
  const product = products.find(p => p.id === parseInt(req.params.id));
  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }

  // Update the product fields
  product.name = req.body.name ?? product.name;
  product.description = req.body.description ?? product.description;
  product.price = req.body.price ?? product.price;
  product.category = req.body.category ?? product.category;
  product.inStock = req.body.inStock ?? product.inStock;

  res.json(product);
});

// DELETE /api/products/:id - Delete a product
app.delete('/api/products/:id', (req, res) => {
  const productIndex = products.findIndex(p => p.id === parseInt(req.params.id));
  if (productIndex === -1) {
    return res.status(404).json({ message: 'Product not found' });
  }

  const deletedProduct = products.splice(productIndex, 1);
  res.json({ message: 'Product deleted successfully', deletedProduct });
});

// GET /api/products/stats - Count products by category
app.get('/api/products/stats', asyncHandler(async (req, res) => {
  const stats = products.reduce((acc, p) => {
    acc[p.category] = (acc[p.category] || 0) + 1;
    return acc;
  }, {});

  const total = products.length;

  res.json({
    totalProducts: total,
    countByCategory: stats
  });
}));


// -----------------------------
// START SERVER
// -----------------------------
const PORT = 3000;

// Logger middleware is already defined at the top of the file

// In production store the key in an env variable, e.g., process.env.API_KEY
const VALID_API_KEY = '12345';

const authenticate = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey && apiKey === VALID_API_KEY) return next();
  return res.status(401).json({ error: 'Unauthorized: invalid or missing API key' });
};

const validateProduct = (req, res, next) => {
  const { name, description, price, category, inStock } = req.body;

  if (!name || !description || price == null || !category || inStock == null) {
    return res.status(400).json({ error: 'All product fields are required' });
  }
  if (typeof price !== 'number') {
    return res.status(400).json({ error: 'Price must be a number' });
  }
  if (typeof inStock !== 'boolean') {
    return res.status(400).json({ error: 'inStock must be boolean' });
  }
  next();
};
// Use the authenticate middleware for all routes
app.use(authenticate);

// Use the validateProduct middleware for POST and PUT routes
app.post('/api/products', validateProduct, (req, res) => {
  // ... existing code ...
});     

// In-memory products has been moved to the top of the file

// Public route (no auth)
app.get('/api/products', (req, res) => {
  res.json(products);
});

// Get by id (public)
app.get('/api/products/:id', (req, res) => {
  const product = products.find(p => p.id === parseInt(req.params.id));
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

// Protected: Create product (auth + validation)
app.post('/api/products', authenticate, validateProduct, (req, res) => {
  const newProduct = { id: products.length + 1, ...req.body };
  products.push(newProduct);
  res.status(201).json(newProduct);
});

// Protected: Update product (auth + validation)
app.put('/api/products/:id', authenticate, validateProduct, (req, res) => {
  const product = products.find(p => p.id === parseInt(req.params.id));
  if (!product) return res.status(404).json({ error: 'Product not found' });
  Object.assign(product, req.body);
  res.json(product);
});

// Protected: Delete product (auth)
app.delete('/api/products/:id', authenticate, (req, res) => {
  const idx = products.findIndex(p => p.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Product not found' });
  const deleted = products.splice(idx, 1);
  res.json({ message: 'Product deleted', deleted });
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
// Server is already started above, removing duplicate listen call

// Server startup should be the last thing we do
app.use((req, res, next) => {
  next(new NotFoundError('Route not found'));
});

app.use((err, req, res, next) => {
  // Log error server-side (good for debugging)
  console.error(`ERROR: ${err.name} - ${err.message}`);

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    status: 'error',
    errorType: err.name || 'Error',
    message: err.message || 'Internal Server Error'
  });
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
