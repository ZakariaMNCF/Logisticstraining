{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    },
    {
      "src": "SAP-Customer.html",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "server.js"
    },
    {
      "src": "/(.*)",
      "dest": "SAP-Customer.html"
    }
  ],
  "env": {
    "MONGO_URI": "mongodb+srv://MOUNSIF:Zaki210300@cluster0.v3i952t.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0",
    "NODE_ENV": "production"
  }
}
