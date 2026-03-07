const express = require('express');
const mongoose = require('mongoose');
const User = require('./models/user');

const app = express();
const port = 3000;
app.set("view engine", "ejs");
app.set("views", "./views");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static('public'));


// MongoDB connection
mongoose.connect('mongodb://localhost:27017/studyapp')
.then(() => console.log('MongoDB connected'))
.catch(err => console.log(err));




app.get('/', (req, res) => {
  res.render('login');
});
app.get('/signup', (req, res) => {
  res.render('signup');
});
app.get('/dashboard', (req, res) => {
  res.render('dashboard');
}
);

app.post("/login", async (req, res) => {

  console.log("Login route hit");

  const { username, password } = req.body;

  const user = await User.findOne({ username });

  if (!user) {
    return res.send("User not found");
  }

  if (user.password === password) {
    console.log("Password correct");
    return res.redirect("/dashboard");
  }

  res.send("Invalid Password");

});
app.post("/signup", async (req, res) => {
  const { username, email, password } = req.body;
  const newUser = new User({
    username,
    email,
    password,
    createdAt: new Date(),
    views: 0,
    
  });
  await newUser.save();
  console.log(await User.find());
  res.redirect('/dashboard');

});



app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});