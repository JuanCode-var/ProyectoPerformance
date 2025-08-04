// server/services/mongo.js
import mongoose from 'mongoose';

export async function connectDB() {
  try {
    await mongoose.connect(
      process.env.MONGO_URI || 'mongodb://localhost:27017/BD_Diagnostico_Rendimiento',
      // {
      //   useNewUrlParser: true,
      //   useUnifiedTopology: true,
      // },
    );
    console.log('✅ Conexión a MongoDB exitosa');
  } catch (error) {
    console.error('❌ Error de conexión a MongoDB:', error.message);
    process.exit(1);
  }
};

