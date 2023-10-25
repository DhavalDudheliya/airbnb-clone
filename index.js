const express = require("express");
const app = express();
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const CookieParser = require("cookie-parser");
const { default: mongoose } = require("mongoose");
const User = require("./models/User");
const Place = require("./models/place");
const Booking = require("./models/Booking");
const cookieParser = require("cookie-parser");
const ImageDownloader = require("image-downloader");
const multer = require("multer");
const fs = require("fs");
const { log } = require("console");
const { resolve } = require("path");
const { rejects } = require("assert");
require("dotenv").config();
const PORT = process.env.PORT || 4000;
const BASE_URL = process.env.BASE_URL;

const bcryptSalt = bcrypt.genSaltSync(10);
const jwtSecret = "jaiSwaminarayan";

app.use(express.json());
app.use(cookieParser());

app.use("/uploads", express.static(__dirname + "/uploads"));

app.use(
  cors({
    credentials: true,
    origin: "https://airbnbclone-clone.onrender.com",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Content-Type", "Authorization"],
  })
);

app.options('*', cors());


// 5hvN9F7ic5jDxX3P

mongoose.connect(process.env.MONGO_URL);
app.listen(PORT);

function getUserDataFromReq(req) {
  return new Promise((resolve, reject) => {
    jwt.verify(req.cookies.token, jwtSecret, {}, async (err, userData) => {
      if (err) throw err;
      resolve(userData);
    });
  });
}

app.post(`/register`, async (req, res) => {
  const { name, email, password } = req.body;
  console.log(name);
  try {
    // Create User
    const userDoc = await User.create({
      name,
      email,
      password: bcrypt.hashSync(password, bcryptSalt),
    });
  } catch (e) {
    res.status(422).json(e);
  }
});

app.post(`/login`, async (req, res) => {
  const { email, password } = req.body;
  const UserDoc = await User.findOne({ email });
  if (UserDoc) {
    const passOk = bcrypt.compareSync(password, UserDoc.password);
    if (passOk) {
      jwt.sign(
        { email: UserDoc.email, id: UserDoc._id, name: UserDoc.name },
        jwtSecret,
        {},
        (err, token) => {
          if (err) throw err;
          res.cookie("token", token).json(UserDoc);
        }
      );
    } else {
      return res.status(422).json({ message: "not okay" });
    }
  } else {
    res.json(null);
  }
});

app.get(`/profile`, async (req, res) => {
  const { token } = req.cookies;
  if (!token) {
    return res.json(null);
  }

  try {
    const userData = await jwt.verify(token, jwtSecret);
    const { name, email, _id } = await User.findById(userData.id);
    res.json({ name, email, _id });
  } catch (err) {
    // Handle error (e.g., token is invalid)
    res.status(401).json({ error: 'Unauthorized' });
  }
});


app.post(`/logout`, (req, res) => {
  res.cookie("token", "").json(true);
});

app.post(`/upload-by-link`, async (req, res) => {
  const { link } = req.body;
  const newName = "photo" + Date.now() + ".jpg";
  await ImageDownloader.image({
    url: link,
    dest: __dirname + "/uploads/" + newName,
  });
  res.json(newName);
});

const photosMiddleware = multer({ dest: "uploads/" });
app.post(
  `/upload`,
  photosMiddleware.array("photos", 100),
  (req, res) => {
    const uploadedFiles = [];
    for (let i = 0; i < req.files.length; i++) {
      const { path, originalname } = req.files[i];
      const parts = originalname.split(".");
      const ext = parts[parts.length - 1];
      const newPath = path + "." + ext;
      fs.renameSync(path, newPath);
      uploadedFiles.push(newPath.replace("uploads\\", ""));
    }
    res.json(uploadedFiles);
  }
);

app.post(`/places`, (req, res) => {
  const { token } = req.cookies;
  const {
    title,
    address,
    photos,
    description,
    perks,
    extraInfo,
    checkIn,
    checkOut,
    maxGuest,
    price,
  } = req.body;
  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    if (err) throw err;
    const placeDoc = await Place.create({
      owner: userData.id,
      title,
      address,
      photos,
      description,
      perks,
      extraInfo,
      checkIn,
      checkOut,
      maxGuest,
      price,
    });
    res.json(placeDoc);
  });
});

app.get(`/user-places`, (req, res) => {
  const { token } = req.cookies;
  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    if (err) throw err;
    const { id } = userData;
    res.json(await Place.find({ owner: id }));
  });
});

app.get(`/places/:id`, async (req, res) => {
  const { id } = req.params;
  res.json(await Place.findById(id));
});

app.put(`/places`, async (req, res) => {
  const { token } = req.cookies;
  const {
    id,
    title,
    address,
    photos: addedPhotos,
    description,
    perks,
    extraInfo,
    checkIn,
    checkOut,
    maxGuest,
    price,
  } = req.body;
  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    if (err) throw err;
    const placeDoc = await Place.findById(id);
    if (userData.id === placeDoc.owner.toString()) {
      placeDoc.set({
        title,
        address,
        photos: addedPhotos,
        description,
        perks,
        extraInfo,
        checkIn,
        checkOut,
        maxGuest,
        price,
      });
      await placeDoc.save();
      res.json("ok");
    }
  });
});

app.get(`/places`, async (req, res) => {
  res.json(await Place.find());
});

app.post(`/bookings`, async (req, res) => {
  const userData = await getUserDataFromReq(req);
  const { place, checkIn, checkOut, numberOfGuests, name, phoneNo, price } =
    req.body;

  Booking.create({
    place,
    user: userData.id,
    checkIn,
    checkOut,
    numberOfGuests,
    name,
    phoneNo,
    price,
  })
    .then((doc) => {
      res.json(doc);
    })
    .catch((err) => {
      throw err;
    });
});

app.get(`/bookings`, async (req, res) => {
  const userData = await getUserDataFromReq(req);
  res.json(await Booking.find({ user: userData.id }).populate("place"));
});
