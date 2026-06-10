const express = require('express');
const crypto = require('crypto');
const app = express();
app.use(express.json());

// ========== ЕДИНАЯ БАЗА ДАННЫХ ==========
let products = [
    { id: 1, name: "Ноутбук", price: 1000, inStock: true, created: "2024-01-01" },
    { id: 2, name: "Мышь", price: 20, inStock: true, created: "2024-01-02" },
    { id: 3, name: "Клавиатура", price: 50, inStock: false, created: "2024-01-03" }
];
let nextId = 4;

// ========== ПОЛЬЗОВАТЕЛИ И ТОКЕНЫ ==========
const users = [
    { id: 1, login: "admin", password: "admin123" },
    { id: 2, login: "user", password: "user456" }
];

// Хранилище токенов: ключ — токен, значение — { userId, expiresAt }
const tokens = new Map();
const TOKEN_LIFETIME_MS = 60 * 60 * 1000; // 1 час

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
function findProduct(id) {
    return products.find(p => p.id === id);
}

function findProductIndex(id) {
    return products.findIndex(p => p.id === id);
}

// Генерация нового токена
function generateToken(userId) {
    const token = crypto.randomUUID();
    const expiresAt = Date.now() + TOKEN_LIFETIME_MS;
    tokens.set(token, { userId, expiresAt });
    return token;
}

// Middleware для проверки токена
function requireAuth(req, res, next) {
    const token = req.headers['x-auth-token'];
    if (!token) {
        return res.status(401).json({ error: "Unauthorized", message: "Missing x-auth-token header" });
    }
    const tokenData = tokens.get(token);
    if (!tokenData) {
        return res.status(401).json({ error: "Unauthorized", message: "Invalid token" });
    }
    if (Date.now() > tokenData.expiresAt) {
        tokens.delete(token);
        return res.status(401).json({ error: "Unauthorized", message: "Token expired" });
    }
    req.userId = tokenData.userId;
    next();
}

// ========== V01 - БЕЗ АВТОРИЗАЦИИ (как было) ==========
app.get('/v01/products/', (req, res) => {
    const simplified = products.map(p => ({ id: p.id, name: p.name, price: p.price }));
    res.json(simplified);
});

app.get('/v01/products/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const product = findProduct(id);
    if (product) {
        res.json({ id: product.id, name: product.name, price: product.price });
    } else {
        res.status(404).json({ error: "Product not found" });
    }
});

app.post('/v01/products/', (req, res) => {
    const { name, price } = req.body;
    if (!name || !price) {
        return res.status(400).json({ error: "Missing name or price" });
    }
    const newProduct = { 
        id: nextId++, 
        name, 
        price, 
        inStock: true,
        created: new Date().toISOString()
    };
    products.push(newProduct);
    res.status(201).json({ 
        message: "Product created in v01", 
        product: { id: newProduct.id, name: newProduct.name, price: newProduct.price }
    });
});

app.put('/v01/products/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const { name, price } = req.body;
    const index = findProductIndex(id);
    if (index === -1) return res.status(404).json({ error: "Product not found" });
    if (!name || !price) return res.status(400).json({ error: "Missing name or price" });
    products[index] = { ...products[index], name, price, updated: new Date().toISOString() };
    res.json({ 
        message: "Product updated in v01", 
        product: { id: products[index].id, name: products[index].name, price: products[index].price }
    });
});

app.patch('/v01/products/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const updates = req.body;
    const index = findProductIndex(id);
    if (index === -1) return res.status(404).json({ error: "Product not found" });
    products[index] = { ...products[index], ...updates, patched: new Date().toISOString() };
    res.json({ 
        message: "Product patched in v01", 
        product: { id: products[index].id, name: products[index].name, price: products[index].price }
    });
});

app.delete('/v01/products/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const index = findProductIndex(id);
    if (index === -1) return res.status(404).json({ error: "Product not found" });
    const deleted = products.splice(index, 1)[0];
    res.json({ message: "Product deleted", deletedProduct: { id: deleted.id, name: deleted.name } });
});

// ========== V02 - ОТКРЫТЫЕ GET, ОСТАЛЬНЫЕ - ТОЛЬКО С ТОКЕНОМ ==========
app.get('/v02/products/', (req, res) => {
    res.json(products);
});

app.get('/v02/products/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const product = findProduct(id);
    if (product) {
        res.json(product);
    } else {
        res.status(404).json({ error: "Product not found" });
    }
});

// Логин v02 — возвращает токен
app.post('/v02/login', (req, res) => {
    const { login, password } = req.body;
    const user = users.find(u => u.login === login && u.password === password);
    if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = generateToken(user.id);
    res.json({ token, expiresIn: TOKEN_LIFETIME_MS / 1000 + " seconds" });
});

// Защищённые методы (требуют токен)
app.post('/v02/products/', requireAuth, (req, res) => {
    const { name, price, inStock } = req.body;
    if (!name || !price) {
        return res.status(400).json({ error: "Missing name or price" });
    }
    const newProduct = { 
        id: nextId++, 
        name, 
        price, 
        inStock: inStock !== undefined ? inStock : true,
        created: new Date().toISOString()
    };
    products.push(newProduct);
    res.status(201).json({ message: "Product created in v02", product: newProduct });
});

app.put('/v02/products/:id', requireAuth, (req, res) => {
    const id = parseInt(req.params.id);
    const { name, price, inStock } = req.body;
    const index = findProductIndex(id);
    if (index === -1) return res.status(404).json({ error: "Product not found" });
    products[index] = { 
        ...products[index], 
        name: name || products[index].name,
        price: price || products[index].price,
        inStock: inStock !== undefined ? inStock : products[index].inStock,
        updated: new Date().toISOString()
    };
    res.json({ message: "Product updated in v02", product: products[index] });
});

app.patch('/v02/products/:id', requireAuth, (req, res) => {
    const id = parseInt(req.params.id);
    const updates = req.body;
    const index = findProductIndex(id);
    if (index === -1) return res.status(404).json({ error: "Product not found" });
    products[index] = { ...products[index], ...updates, patched: new Date().toISOString() };
    res.json({ message: "Product patched in v02", product: products[index] });
});

app.delete('/v02/products/:id', requireAuth, (req, res) => {
    const id = parseInt(req.params.id);
    const index = findProductIndex(id);
    if (index === -1) return res.status(404). json({ error: "Product not found" });
    const deleted = products.splice(index, 1)[0];
    res.json({ message: "Product deleted from v02", deletedProduct: deleted });
});

// ========== V03 - НОВАЯ ВЕРСИЯ С productId ВМЕСТО id ==========
// Функция для преобразования product -> productId
function convertToV03(product) {
    if (!product) return null;
    const { id, ...rest } = product;
    return { productId: id, ...rest };
}

function convertArrayToV03(productsArray) {
    return productsArray.map(p => convertToV03(p));
}

// Логин v03 — возвращает токен (отдельный маршрут)
app.post('/v03/login', (req, res) => {
    const { login, password } = req.body;
    const user = users.find(u => u.login === login && u.password === password);
    if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = generateToken(user.id);
    res.json({ token, expiresIn: TOKEN_LIFETIME_MS / 1000 + " seconds" });
});

// V03 endpoints
app.get('/v03/products/', (req, res) => {
    res.json(convertArrayToV03(products));
});

app.get('/v03/products/:productId', (req, res) => {
    const id = parseInt(req.params.productId);
    const product = findProduct(id);
    if (product) {
        res.json(convertToV03(product));
    } else {
        res.status(404).json({ error: "Product not found" });
    }
});

app.post('/v03/products/', requireAuth, (req, res) => {
    const { name, price, inStock } = req.body;
    if (!name || !price) {
        return res.status(400).json({ error: "Missing name or price" });
    }
    const newProduct = { 
        id: nextId++, 
        name, 
        price, 
        inStock: inStock !== undefined ? inStock : true,
        created: new Date().toISOString()
    };
    products.push(newProduct);
    res.status(201).json({ 
        message: "Product created in v03", 
        product: convertToV03(newProduct) 
    });
});

app.put('/v03/products/:productId', requireAuth, (req, res) => {
    const id = parseInt(req.params.productId);
    const { name, price, inStock } = req.body;
    const index = findProductIndex(id);
    if (index === -1) return res.status(404).json({ error: "Product not found" });
    products[index] = { 
        ...products[index], 
        name: name || products[index].name,
        price: price || products[index].price,
        inStock: inStock !== undefined ? inStock : products[index].inStock,
        updated: new Date().toISOString()
    };
    res.json({ 
        message: "Product updated in v03", 
        product: convertToV03(products[index]) 
    });
});

app.patch('/v03/products/:productId', requireAuth, (req, res) => {
    const id = parseInt(req.params.productId);
    const updates = req.body;
    const index = findProductIndex(id);
    if (index === -1) return res.status(404).json({ error: "Product not found" });
    products[index] = { ...products[index], ...updates, patched: new Date().toISOString() };
    res.json({ 
        message: "Product patched in v03", 
        product: convertToV03(products[index]) 
    });
});

app.delete('/v03/products/:productId', requireAuth, (req, res) => {
    const id = parseInt(req.params.productId);
    const index = findProductIndex(id);
    if (index === -1) return res.status(404).json({ error: "Product not found" });
    const deleted = products.splice(index, 1)[0];
    res.json({ 
        message: "Product deleted from v03", 
        deletedProduct: convertToV03(deleted) 
    });
});

// ========== КОРНЕВОЙ МАРШРУТ ==========
app.get('/', (req, res) => {
    res.json({ 
        versions: ["v01", "v02", "v03"],
        description: "v01 – открытый API (без авторизации). v02 – GET открыты, для изменений требуется токен. v03 – то же, что v02, но используется productId вместо id.",
        endpoints: {
            v01: {
                GET: ["/v01/products/", "/v01/products/:id"],
                POST: "/v01/products/",
                PUT: "/v01/products/:id",
                PATCH: "/v01/products/:id",
                DELETE: "/v01/products/:id"
            },
            v02: {
                GET: ["/v02/products/", "/v02/products/:id"],
                POST: "/v02/products/ (requires token)",
                PUT: "/v02/products/:id (requires token)",
                PATCH: "/v02/products/:id (requires token)",
                DELETE: "/v02/products/:id (requires token)",
                LOGIN: "POST /v02/login"
            },
            v03: {
                GET: ["/v03/products/", "/v03/products/:productId"],
                POST: "/v03/products/ (requires token)",
                PUT: "/v03/products/:productId (requires token)",
                PATCH: "/v03/products/:productId (requires token)",
                DELETE: "/v03/products/:productId (requires token)",
                LOGIN: "POST /v03/login"
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));
