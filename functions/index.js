const functions = require('firebase-functions');

const admin = require('firebase-admin');

admin.initializeApp(functions.config().firebase);

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
exports.helloWorld = functions.https.onRequest((request, response) => {
 response.json({ "messages": [ { "text": "Hello from Firebase!" } ] });
});

const questions = [
	"Do you take initiatives?",
	"Do you take care of people?",
	"Do you prefer to be alone?",
	"Do you prefer to listen than to talk?",
	"Do you feel rarely tired?"
]

/*
	Map the answer text to the answer code.
*/
const answerCodeMapPerLang = {
	"en": {
		"I disagree": -3,
		"I don't know": 0,
		"I agree": 3
	},
	"fr": {
		"Je désapprouve": -3,
		"Je ne sais pas": 0,
		"J'approuve": 3
	}
}

/*
	Get the next 6 factors question given the previous question id
	params:
	 - "questionId"   : the previous question id
*/
exports.sixfactorsGetNextQuestion = functions.https.onRequest((request, response) => {

  console.log("sixfactorsGetNextQuestion : " + JSON.stringify(request.query) );
  
  // Grab the questionId parameter.
  const questionId = request.query["questionId"];
  // Parse the parameter as an integer
  var questionIndex = parseInt(questionId, 10);

  // Set 0 if it is not a number or increment the question index
  if( isNaN(questionIndex) ) {
  	questionIndex = 0;
  } else {
  	questionIndex++;
  }


  if( questionIndex >= 0 && questionIndex < questions.length ) {

  	response.json( {
		"set_attributes": 
		{
			"isComplete": false,
			"questionId": questionIndex,
			"questionText": questions[ questionIndex ],
		}
	});

  } else {

  	response.json( {
		"set_attributes": 
		{
			"isComplete": true,
			"questionId": questions.length,
			"questionText": "",
		}
	});

  }
 
  
});

/*
	Save the user answer of a given question
	params:
	 - "chat user id"   : the user id in Chatfuel
	 - "locale"         : the current user's locale
	 - "questionId"     : the ID of the question
	 - "userAnswer"     : the user answer (localized text)
*/
exports.sixfactorsSaveAnswer = functions.https.onRequest((request, response) => {


  console.log("sixfactorsSetAnswer : " + JSON.stringify(request.body) );
  
  // Grab the chatfuel user ID parameter.
  const userId     = request.body["chatfuel user id"];
  // Grab the current user locale
  const locale     = request.body["locale"];
  // Grab the question ID parameter.
  const questionId = request.body["questionId"];
  // Grab the user answer parameter.
  const userAnswer = request.body["userAnswer"];

  if( !verifyParam(userId) ) {
  	badRequest(response, "Unable to find the user id.");
  	return;
  }

  if( !verifyParam(locale) ) {
  	badRequest(response, "Unable to find the user locale.");
  	return;
  }

  if( !verifyParam(questionId) ) {
  	badRequest(response, "Unable to find the question ID.");
  	return;
  }

  if( !verifyParam(userAnswer) ) {
  	badRequest(response, "Unable to find the user answer.");
  	return;
  }

  const lang = getLang(locale);

  const answerCode = getAnswerCode(lang, userAnswer);

  var answer = {};
  answer["lastQuestionId"] = questionId;
  answer[questionId] = answerCode;

  const userAnswersRef = admin.database().ref('/sixfactors/answers').child(userId);

  userAnswersRef.update(answer)
  .then(function() {
	response.end();
  });
	
});

/*
	Get answer code from the answer localized text.
	params:
	 - lang : the current user language
	 - userAnswer : the user answer 
*/
function getAnswerCode(lang, userAnswer) {

	var codeMap = answerCodeMapPerLang[lang];

	if( codeMap === undefined || codeMap === null ) {
		codeMap = answerCodeMapPerLang[lang];
	}

	return codeMap[userAnswer];

}

/*
	Verify the value of a query parameter.
	Returns true if the value is correct, false otherwise
	params:
	 - value        : the param value (string)
*/
function verifyParam(value) {

  if( value === undefined || value === null || value.length === 0 ) {
  	return false;
  }

  return true;

}

/*
	Send a bad request status with a message.
	params:
	 - response     : the response to the HTTP request
	 - message : the message to return if the request is not valid
*/
function badRequest(response, message) {

	console.log(message);

	response.status(400).json({ "messages": [ { "text": message } ] });

}

/*
	Get the language from the user locale.
	params:
	 - locale : the current user locale 
*/
function getLang(locale) {
	
	return "en";
	//return locale.substring(0, 2);

}
