require("dotenv").config();
const express = require('express');
const mongoose = require('mongoose');
const User = require('./models/user');
const multer = require("multer");
const pdfParse = require("pdf-parse");
const Groq = require("groq-sdk");
const Tesseract = require("tesseract.js");


const app = express();
const port = 3000;
const upload = multer({ storage: multer.memoryStorage() });
app.set("view engine", "ejs");
app.set("views", "./views");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static('public'));


// MongoDB connection
mongoose.connect('mongodb://localhost:27017/studyapp')
.then(() => console.log('MongoDB connected'))
.catch(err => console.log(err));


const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});



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


  const { username, password } = req.body;

  const user = await User.findOne({ username });

  if (!user) {
    return res.send("User not found");
  }

  if (user.password === password) {
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


app.get("/summarize", (req,res)=>{
  res.render("summarize",{summary: null});
}
);


app.post("/summarize", upload.single("file"), async (req,res)=>{

try {

let text = "";

const fileBuffer = req.file.buffer;
const fileType = req.file.mimetype;

// If file is PDF
if(fileType === "application/pdf"){

const data = await pdfParse(fileBuffer);
text = data.text;

}

// If file is image (paper notes)
else if(fileType.startsWith("image/")){

const result = await Tesseract.recognize(
fileBuffer,
"eng"
);

text = result.data.text;

}

else{
return res.send("Unsupported file format");
}

// limit text size for AI
text = text.slice(0,4000);

const completion = await groq.chat.completions.create({
model: "llama-3.3-70b-versatile",
messages: [
{
role: "user",
content: `Summarize this document in short so user can understand it easily in simple bullet points:\n\n${text}`
}
]
});

const summary = completion.choices[0].message.content;

res.render("summarize",{summary});

}
catch(err){
console.log(err);
res.send("Error summarizing file");
}

});
app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});