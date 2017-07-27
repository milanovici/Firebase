'use strict';

const functions = require('firebase-functions');
const admin = require("firebase-admin");
admin.initializeApp(functions.config().firebase);

const moment = require('moment');
const cors = require('cors')({origin: true});
const nodemailer = require('nodemailer');

var securityToken = '##############';

// Keys must be non-empty strings and can't contain ".", "#", "$", "/", "[", or "]"

exports.dailyReport = functions.https.onRequest((req, res) => {
	cors(req, res, () => {
		if(req.query.token == securityToken){
			admin.database().ref('/categories').once('value', function(categoriesSnapshot){
				let categoriesVal = categoriesSnapshot.val();
				let todayDate = moment().format("DD.MM.YYYY");
				let todayDateWithoutDots = moment().format("DDMMYYYY");
				let categoryReport = {};
				let cagegoriesArray = Object.keys(categoriesVal);
				let counter = cagegoriesArray.length;
				cagegoriesArray.forEach(function(categoryKey){
					let categoryName = categoriesVal[categoryKey]['name'];
					console.log("Calculating for category : ", categoryName);
					admin.database().ref('/' + categoryName + 'Questions').once("value").then(function(s){ // Get category from database
								let val = s.val(); // JSON
								let questionsData = [];
								Object.keys(val).forEach(function(key){ // Iterate through DB questions
									let questionId = val[key]['id'];
									let questionText = val[key]['text'];

									let dislikes = val[key]['dislikes'];
									let sumOfDislikesForDay = 0;
									if(dislikes){
										dislikes.forEach(function(d){
											d = JSON.parse(d);
											if(d['date'] === todayDate)
												sumOfDislikesForDay += 1;
										});
									}

									let likes = val[key]['likes'];
									let sumOfLikesForDay = 0;
									if(likes){
										likes.forEach(function(d){
											d = JSON.parse(d);
											if(d['date'] === todayDate)
												sumOfLikesForDay += 1;
										});
									}
									questionsData.push({'sumOfLikesForDay': sumOfLikesForDay, 'sumOfDislikesForDay' : sumOfDislikesForDay, 'questionId' : questionId, 'questionText': questionText});
								});
								categoryReport[categoryName] = questionsData;
								counter -= 1;
								if(counter===0){
									let newReport = admin.database().ref().child('reports');
									newReport.update({[todayDateWithoutDots] : categoryReport});
									console.log("Adding new report for date : ", todayDate);
									res.status(200).send({'status': 'OK'});
								}
					});
					console.log("End categories for.");
				});
			});
		}
	});
});

exports.reportForPeriod = functions.https.onRequest((req, res) => {
	cors(req, res, () => {
		if(req.query.token == securityToken){
			let startDate, endDate, categoryName;
			try{
				categoryName = req.query.category.toLowerCase();
				startDate = moment(req.query.startDate, "DD.MM.YYYY");
				endDate = moment(req.query.endDate, "DD.MM.YYYY");
			}catch(err){
				res.status(400).send({'message' : 'Bad format for paramterers'});
				return;
			}
			if(!startDate || !endDate || !startDate.isValid() || !endDate.isValid()){
				res.status(400).send({'message' : 'No startDate or endDate!'});
				return;
			}
			if (startDate > endDate){
				res.status(400).send({'message' : 'startDate is before endDate!'});
				return;
			}
			admin.database().ref('/reports').once("value").then(function(s){
				let reportVal = s.val(); // reports node
				let repsonseData = {};
				Object.keys(reportVal).forEach(function(reportDateStr){
					let reportDate = moment(reportDateStr, "DDMMYYYY");
					if(startDate <= reportDate && reportDate <= endDate){
						console.log("Calculating report for date : ", reportDateStr);
						let reportForDayArray = reportVal[reportDateStr][categoryName];
						console.log(reportForDayArray);
						if(!reportForDayArray){
							//res.status(400).send({'message' : 'categoryName not found!'});
							return;
						}
						Object.keys(reportForDayArray).forEach(function(reportKey){ 
							// el = { questionId: 9, sumOfDislikesForDay: 0, sumOfLikesForDay: 0 }
							let el = reportForDayArray[reportKey];
							let questionId = el['questionId'];
							let questionText = el['questionText'];
							if(questionId in repsonseData){
								repsonseData[questionId]['dislikes'] += el['sumOfDislikesForDay'];
								repsonseData[questionId]['likes'] += el['sumOfLikesForDay'];
							}else{
								repsonseData[questionId] = {'dislikes': el['sumOfDislikesForDay'],
													 'likes': el['sumOfLikesForDay'], 'questionText': questionText, 'questionId': questionId};
							}
						});
					}
				});
			res.status(200).send({'STATUS' : 'OK', 'DATA' : repsonseData});
			});
		}
	});
});


exports.deleteQuestionFromReports = functions.https.onRequest((req, res) => {
	cors(req, res, () => {
		if(req.query.token == securityToken){
			let questionId = req.query.questionId;
			let categoryName = req.query.category.toLowerCase();
			admin.database().ref('/reports').once("value").then(function(s){
				let reportVal = s.val();
				Object.keys(reportVal).forEach(function(reportDateStr){
					let reportForDayArray = reportVal[reportDateStr][categoryName];
					reportForDayArray.forEach(function(el, index){
						if(el['questionId'] == questionId){
							console.log('Deleting question with id : ', questionId);
							admin.database().ref('/reports/' + reportDateStr + '/' + categoryName + '/' + index).remove();
						}
					});
				});
				res.status(200).send({'STATUS' : 'OK'});
			});
		}
	});
});

var transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: '###############',
    pass: ''###############','
  }
});

var mailOptions = {
  from: '###############',,
  subject: '###############',,
  html:  '###############',;
}


function validateEmail(email) {
    var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email);
}

exports.sendEmail = functions.https.onRequest((req, res) => {
	cors(req, res, () => {
		if(req.query.token == securityToken){
			let toEmail = req.query.toEmail;
			mailOptions['to'] = toEmail;
			if(!validateEmail(toEmail)){
				res.status(400).send({'message' : 'Email pattern not valid!'});
				return;
			}

			transporter.sendMail(mailOptions, function(error, info){
			  if (error) {
			    console.log(error);
			    res.status(400).send({'message': 'Email not sent!'});
			  } else {
			    console.log('Email sent to : ',toEmail);
			  	res.status(200).send({'STATUS' : 'OK'});
			  }
			});
		}
	});
});






