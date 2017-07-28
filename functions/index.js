const functions = require('firebase-functions');

const admin = require('firebase-admin');

admin.initializeApp(functions.config().firebase);


const sixfactors = require('./data/sixfactors')

/*
	Map the answer text to the answer code.
*/
const ANSWER_CODES = sixfactors.answerCodes;

/*
Set english as the default language.
*/
const DEFAULT_LANG = "en";

/*
	Get the next 6 factors question given the previous question id
	params:
	 - "chat user id"   : the user id in Chatfuel
	 - "questionId"   : the previous question id
	 - "locale"       : the current user language
*/
exports.sixfactorsGetNextQuestion = functions.https.onRequest((request, response) => {

  console.log("sixfactorsGetNextQuestion : " + JSON.stringify(request.query) );
  
  // Grab the chatfuel user ID parameter.
  const userId     = request.query["chatfuel user id"];
  // Grab the questionId parameter.
  const lastQuestionId = request.query["questionId"];
  // Grab the locale parameter.
  const locale = request.query["locale"];

  if( !verifyParam(userId) ) {
  	badRequest(response, "Unable to find the user id.");
  	return;
  }

  if( !verifyParam(locale) ) {
  	badRequest(response, "Unable to find the user locale.");
  	return;
  }

  const lang = getLang(locale);

  // CALLBACKS : Create callbacks function to chain into a promise.
  const __retrieveLastQuestionId = (userId) => {

  	console.log("__retrieveLastQuestionId: userId = " + userId );

  	const lastQuestionRef = admin.database().ref('/sixfactors/answers').child(userId).child("lastQuestionId");

  	return lastQuestionRef.once("value")
  	.then( (dataSnapshot) => {

  		if( !dataSnapshot.exists() ) {
  			return -1;
  		}

  		return dataSnapshot.val();

  	} );
  }

  const __incrementQuestionId = (lastQuestionId) => {

  	console.log("__incrementQuestionId: lastQuestionId = " + lastQuestionId );

  	return lastQuestionId + 1;
  }

  const __endOfTest = (reason) => {

  	console.log("__endOfTest: reason = " + reason);

  	return {
  			"isComplete": true,
  			"id": -1,
  			"label": ""
  		}
  };

  const __fetchQuestion = (questionId) => {

  	console.log("__fetchQuestion: questionId = " + questionId );

  	const question = sixfactors.questions[questionId];

  	if( question === undefined ) {
  		return __endOfTest("The question " + questionId + " doesn't exist.")
  	}

  	var questionLabel = question.label[lang];

  	if( questionLabel === undefined ) {
  		questionLabel = question.label[DEFAULT_LANG];
  	}
  	
  	return {
		"isComplete": false,
		"id": questionId,
		"label": questionLabel
	};
  }

  const __createResponse = (question) => {

  	console.log("__createResponse: " + JSON.stringify(question) );

  	response.json( {
		"set_attributes": 
		{
			"isComplete": question.isComplete,
			"questionId": question.id,
			"questionText": question.label,
		}
	});

  }
  // END CALLBACKS
  

  // Get the last question id for this user if the parameter is not valid
  const lastQuestionIndex = parseInt(lastQuestionId, 10);
  var promise;

  if( isNaN(lastQuestionIndex) ) {
  	promise = __retrieveLastQuestionId(userId)
  } else {
  	promise = new Promise( (resolve, reject) => {
  		resolve(lastQuestionIndex);
  	} );
  }

  promise
  	.then(__incrementQuestionId)
	.then(__fetchQuestion).catch(__endOfTest)
	.then(__createResponse);
  
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
  answer["lastQuestionId"] = parseInt(questionId, 10);
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

	var codeMap = ANSWER_CODES[lang];

	if( codeMap === undefined || codeMap === null ) {
		codeMap = ANSWER_CODES[lang];
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
	
	return DEFAULT_LANG;
	//return locale.substring(0, 2);

}
