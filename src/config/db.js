const mongoose = require("mongoose");

async function conectarDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn("Aviso: MONGODB_URI no definida. Continuando sin MongoDB.");
    return false;
  }

  await mongoose.connect(uri);
  console.log("Conectado a MongoDB");
  return true;
}

module.exports = { conectarDB };