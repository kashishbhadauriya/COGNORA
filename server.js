  require("dotenv").config();
  const fs = require("fs");//files aur folders ke saath kaam karne ke liye use hota hai.
  const express = require('express');
  const mongoose = require('mongoose');
  const multer = require("multer");//multer is used to save the files like images pdf etc
  const pdfParse = require("pdf-parse");//pdf ka content extract krta h
  const Groq = require("groq-sdk");//grok  use kr rhe h
  const Tesseract = require("tesseract.js");
  const User = require('./models/user');
  const Summary = require("./models/summary");
  const Quiz = require("./models/quiz");
  const Doubt = require("./models/Doubt");
  const Flashcard = require("./models/flashcard");
  const chat=require("./models/chat");
  const bcrypt = require("bcrypt");//password hashing library
  const session = require("express-session");//authentication ke lie session use kar rhe


  const app = express();//express function joh return krta h object usko app me store krte h
  const port = 3000;
  const upload = multer({ storage: multer.memoryStorage() });
  app.set("view engine","ejs");//Express ko batata hai ki rendering ke liye EJS use karni hai.
  app.set("views", "./views");

  app.use(express.json());//JSON data ko parse karta hai.
  app.use(express.urlencoded({ extended: true }));//HTML forms se aane wale data ko parse karta hai.

  app.use(express.static('public'));//public files of browser me access krne deta h but is sproject me koi bhi public file sh hi nhi toh bhi isko use kia gya h kyu ki shyd kahi use askta h

// MongoDB connection
const dbURI = process.env.MONGO_URI;

mongoose.connect(dbURI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    // Standard practice to help debug connection issues in production logs
  });

  const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
  });

  app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
  }));
  app.get("/login", (req, res) => {
  res.render("login", { error: null }); 
});


  app.get("/",(req,res)=>{
if(req.session.userId){
return res.redirect("/dashboard");
}
else{
res.render("login");
}
});


app.get("/signup", (req, res) => {
  res.render("signup", { error: null });
});



  app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) {
    return res.render("login", { error: "⚠️ User not found. Please sign up first." });
  }
  // compare hashed password
  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.render("login", { error: "⚠️ Incorrect password. Try again." });
  }
  // store user in session
  req.session.userId = user._id;//yeh user id login krte time req.session.userid me save ho jaegi fir har time bss check hog aki yeh h ki nhi 
  res.redirect("/dashboard");
  });


app.post("/signup", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render("signup", {
        error: "⚠️ Email already registered. Please login."
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      username,
      email,
      password: hashedPassword
    });

    await newUser.save();

    req.session.userId = newUser._id;

    res.redirect("/dashboard");

  } catch (err) {
    console.log(err);
    res.render("signup", {
      error: "Something went wrong."
    });
  }
});


  function isLoggedIn(req,res,next){
  if(req.session.userId){
    next();
  }else{
    res.render("login", { error: "⚠️ Please login first." });
  }
}

  app.get('/dashboard', isLoggedIn, (req, res) => {
    res.render('dashboard');
  });

  app.get("/summarize", isLoggedIn,async (req,res)=>{
    const summary = await Summary.findOne({ user: req.session.userId }).sort({ createdAt: -1 });
      res.render("summarize", {
        summary: null
    });
  });


  //post for summary
  app.post("/summarize", upload.single("file"), async (req,res)=>{
  try {
  let text = "";
  if(!req.file){
  return res.send("No file uploaded");
  }
  const fileBuffer = req.file.buffer;//joh file hoti h nodejs me buffer ke form me store hoti h
  const fileType = req.file.mimetype;
  if(fileType === "application/pdf"){
  const data = await pdfParse(fileBuffer);
  text = data.text;
  }
  else if(fileType.startsWith("image/")){
  const result = await Tesseract.recognize(fileBuffer,"eng");
  text = result.data.text;//tesseract direct data return nhi krta h balki bahot sara data deta h islie result.data.text krte h ki bss mail data  mile
  }
  else{
  return res.send("Unsupported file format");
  }
  text = text.slice(0,4000);
  const completion = await groq.chat.completions.create({
  model: "llama-3.3-70b-versatile",
  messages: [
  {
  role: "user",
  content: `
Read the following document and create a short study-friendly summary.
Requirements:
- Use bullet points
- Highlight important concepts
- Keep it concise
- Use simple language
Document:
${text}
` }]});
  const summary = completion.choices[0].message.content;//isme dekho completion.choices ek array h jiska first index lo aur uske andr messege me aau fir uske andr content to joh main content h vh dikh jaega
  await Summary.create({//yeh toh mongodb me save kr rhe h
      filename: req.file.originalname,
  originalText: text,
  user: req.session.userId,
  summary: summary
  });
  res.render("summarize",{summary});
  }
  catch(err){
  console.log(err);
  res.send("Error summarizing file");
  }
  });


  //get for quiz
  app.get("/quiz",isLoggedIn,(req,res)=>{
    const quiz = Quiz.findOne({ user: req.session.userId }).sort({ createdAt: -1 });
  res.render("quiz",{quiz: null});
  }
  );


  //post for quiz
app.post("/quiz", upload.single("file"), async (req, res) => {
  try {
    let text = "";
    if (!req.file) {
      return res.send("No file uploaded");
    }
    const fileBuffer = req.file.buffer;
    const fileType = req.file.mimetype;
    if (fileType === "application/pdf") {
      const pdfData = await pdfParse(fileBuffer);
      text = pdfData.text;
    }
    else {
      return res.send("Unsupported file format");
    }
    text = text.substring(0, 4000);
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{
        role: "user",
        content: `
Generate exactly 10 quiz questions.

For EACH question provide:
- Question
- 4 options (A,B,C,D)
- Correct Answer

Do NOT omit answers.

Format:

Q1. ...

A. ...
B. ...
C. ...
D. ...

Correct Answer: A

Document:
${text}
`
      }]
    });
    const quiz = response.choices[0].message.content;
    await Quiz.create({
      filename: req.file.originalname,
      quizText: quiz,
      user: req.session.userId,
    });
    res.render("quiz", { quiz });
  } catch (error) {
  console.error(error);
  res.status(500).send(error.message);
}
});


  app.get("/doubt", isLoggedIn, (req, res) => {
    const doubt =  Doubt.findOne({ user: req.session.userId }).sort({ createdAt: -1 });
    res.render("doubt", { answer: null, question: "" });
  });
  app.post("/doubt", isLoggedIn, async (req, res) => {
  try{
  const question = req.body.question;
  const prompt = `
You are an expert AI tutor.

Answer the following question in a concise, easy-to-understand, and structured format.

Rules:

* Use simple language.
* Keep the answer focused and not too lengthy.
* Limit the explanation to 5-8 short paragraphs.
* Give only the most important points.
* Recommend 2-3 trusted learning resources by name only.
* Do not generate URLs.

Format:

## Concept

2-3 lines explaining the concept.

## Explanation

A clear explanation in short paragraphs.

## Key Points

* Point 1
* Point 2
* Point 3

## Example

One simple example.

## Learn More

* Resource 1
* Resource 2
* Resource 3

## Summary

1-2 line conclusion.

Question:
${question}
`;
  const response = await groq.chat.completions.create({
  messages:[{ role:"user", content: prompt }],
  model:"llama-3.1-8b-instant"
  });

  const answer = response.choices[0].message.content;
  await Doubt.create({
  question,
  answer,
  userId: req.session.userId
  });
  res.render("doubt",{ answer, question });
  }catch(err){
  console.log(err);
  res.send("Error generating answer");
  }
  });

  app.get("/notes",isLoggedIn,async (req, res) => {
    const summaries = await Summary.find({ user: req.session.userId }).sort({ createdAt: -1 });
    const quizzes = await Quiz.find({ user: req.session.userId }).sort({ createdAt: -1 });
    const doubts = await Doubt.find({ userId: req.session.userId }).sort({ createdAt: -1 });  



  res.render("notes", {
  summaries,
  quizzes,
  doubts
  });

  });


app.get("/flashcards", async (req, res) => {
    try {
        const cards = await Flashcard.find({ user: req.session.userId }).sort({ createdAt: -1 });
        res.render("flashcards", { cards });
    } catch (error) {
        console.log(error);
        res.send("Error loading flashcards");
    }
});


app.post("/flashcards", async (req, res) => {
    const text = req.body.text;
    try {
        const completion = await groq.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: [
                {
                    role: "user",
                    content: `
Generate 5 flashcards from the following notes.
Format:
Question: ...
Answer: ...

Notes:
${text}`
                }
            ]
        });
        const output = completion.choices[0].message.content;
        const flashcards = [];
        const parts = output.split("Question:");
        parts.slice(1).forEach(part => {
            const q = part.split("Answer:")[0].trim();
            const a = part.split("Answer:")[1].trim();
            flashcards.push({
                question: q,
                answer: a
            });
        });
        for (const card of flashcards) {
            await Flashcard.create({
                question: card.question,
                answer: card.answer,
                user: req.session.userId
            });
        }
        res.redirect("/flashcards");
    } catch (error) {
        console.log(error);
        res.send("Error generating flashcards");
    }

});


app.get("/chat", isLoggedIn, (req,res)=>{
  const chats=chat.find({ user: req.session.userId }).sort({ createdAt: -1 });
res.render("chat", { chats });
});


app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;
  try {
    // 1. Get LAST chats (important)
    const previousChats = await chat.find({ user: req.session.userId })
      .sort({ createdAt: -1 })   // latest first
      .limit(30);                // more context
    // reverse to maintain correct order
    previousChats.reverse();
    //  2. Strong SYSTEM PROMPT
    let messages = [
      {
        role: "system",
   content: `
You are COGNORA AI, a smart student-friendly assistant.
and u are developed by kashish bhadauriya.
Rules:
- Always give answers in clean format
- Use headings and bullet points
- Keep answers short and clear
- Avoid long paragraphs
- Make answers look like exam notes
- Highlight keywords using bold
- Structure like:
Definition
Then points
Then types
Never give long paragraph explanations unless asked.
`
      }
    ];
    //  3. Add history properly
    previousChats.forEach(chat => {
      messages.push(
        { role: "user", content: chat.message },
        { role: "assistant", content: chat.response }
      );
    });
    //  4. Add current message
    messages.push({
      role: "user",
      content: userMessage
    });
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: messages,
      temperature: 0.7   // more natural responses
    });
    const reply = completion.choices[0].message.content;
    //  6. Save
    await chat.create({
      message: userMessage,
      response: reply,
      user: req.session.userId
    });
    res.json({ reply });

  } catch (err) {
    console.log(err);
    res.status(500).send("AI Error");
  }

});


  app.get("/logout",(req,res)=>{
  req.session.destroy(()=>{
  res.redirect("/");
  });

  });

  app.listen(port, () => {
    console.log(`Example app listening at http:/localhost:${port}`);
  });
