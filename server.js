const express = require('express');
const app = express();
app.use(express.json());

let products = [
    { id: 1, name: "Ноутбук", price: 1000 },
    { id: 2, name: "Мышь", price: 20 },
    { id: 3, name: "Клавиатура", price: 50 }
];
let nextId = 4;

app.get('/', (req, res) => {
    res.json({ endpoints: ["/products/", "/products/:id", "POST /products/"] });
});

app.get('/products/', (req, res) => {
    res.json(products);
});

app.get('/products/:id', (req, res) => {
    const id = parseInt(req.params.id);
    if (id === 2) {
        return res.status(404).json({ error: "Not found" });
    }
    const product = products.find(p => p.id === id);
    if (product) {
        res.json(product);
    } else {
        res.status(404).json({ error: "Product not found" });
    }
});

app.post('/products/', (req, res) => {
    const { name, price } = req.body;
    if (!name || !price) {
        return res.status(400).json({ error: "Missing name or price" });
    }
    const newProduct = { id: nextId++, name, price };
    products.push(newProduct);
    res.status(201).json({ message: "Product created", product: newProduct });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));
