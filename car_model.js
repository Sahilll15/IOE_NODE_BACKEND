const mongoose = require('mongoose');

const carSchema = new mongoose.Schema({
    numberPlate: {
        type: String,
        required: true,
        unique: true
    },
    inTime: {
        type: Date,
    },
    outTime: {
        type: Date,
    },
    car_model: {
        type: String,
    },
    car_type: {
        type: String,       
    },
    car_color: {
        type: String,
    },
    car_owner: {
        type: String,
    },
    car_owner_contact: {
        type: String,
    },
    car_owner_address: {
        type: String,   
    },
    car_owner_email: {
        type: String,
    },
    car_owner_photo: {
        type: String,
    }
});

const Car = mongoose.model('Car', carSchema);

module.exports = Car;
        
        