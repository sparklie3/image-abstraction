var express = require("express");
var request = require("request");
var mongo = require('mongodb').MongoClient;
const mongodb_url = process.env.MONGOLAB_URI;
//const url = 'mongodb://localhost:27017/data';      
var app = express();



//const flickrApiKey="c527b6a065cf43ea5c5dcd76437e35fb";
var flickrApiBaseUrl = "https://api.flickr.com/services/rest/?format=json&api_key=c527b6a065cf43ea5c5dcd76437e35fb&nojsoncallback=1&";
var flickrMethod = "method=";
//var flickrName = "name=";


app.use(express.static('public'));
app.get('/', function(req,res){
    //console.log(req);
//    res.sendFile('index.html', {root: __dirname});
    //res.sendFile("index.html");
  //  res.end();
});

// need to change url to mongodb_url when in production
function storeData(val){
    mongo.connect(mongodb_url, function (err, db) {
      if (err) {
        console.log('Unable to connect to the mongoDB server. Error:', err);
      } else {
        console.log('Connection established to', mongodb_url);
        var data = db.collection('image-abstraction-search');
        data.insert(val,function (err,dataResponse) {
          if (err){ 
              throw err;
            }
            //console.log(JSON.stringify(val));
          });
        db.close();
      }
    }); 
}

function getData(callback){
  mongo.connect(mongodb_url,function (err, db){
       if (err) {
        console.log('Unable to connect to the mongoDB server. Error:', err);
      } else {
        console.log('Connection established to', mongodb_url);
        var data = db.collection('image-abstraction-search');
        //console.log(data);
        data.find({},{_id:0//this denotes don't show the key
        }).sort({when: -1}).limit(10).
        toArray(function (err,documents) {
            if (err) {
                throw err; // throw err causes the end It is a little like return console.log(err), except here I don't have the return
            }    
            callback(documents);
          });
      }
      db.close();
  });  
}


app.get('/latest', function(req, res) {
    getData(function(callback){
        res.send(callback);
        res.end();
    });
});


function getPhotoInfo(photoIdVal, secretVal, url1, url2, callback){
    return new Promise(function(resolve, reject){
        var method = "flickr.photos.getInfo&";
        var flickrPhotoId = "photo_id=";
        var photoId = photoIdVal+"&";
        var flickrSecret ="secret=";
        var secret = secretVal+"&";
        //console.log(flickrApiBaseUrl+flickrMethod+method+flickrPhotoId+photoId+flickrSecret+secret);
        request.get(flickrApiBaseUrl+flickrMethod+method+flickrPhotoId+photoId+flickrSecret+secret, function(error, response, data) {
            if (!error && response.statusCode == 200) {
                var photoData = JSON.parse(data);
                //console.log(data);
                resolve(callback(photoData, url1, url2));
            }else{
              reject(console.log(error));
          }
        });
    });
    
    
}


app.get('/imagesearch',function(req,res, next){
    var timeStamp = new Date().toJSON();
    var method = "flickr.photos.search&";
    var flickrText = "text=";
    var text = req.query.query+"&";
    var flickrSort ="sort=";
    var sort = "interestingness-desc&";
    var flickrPerPage = "per_page=";
    var perPage = "10&";
    var flickrPage = "page=";
    var page = req.query.page;
    
    
    var insertObject = {
        term: text.substring(0, text.length-1),
        when: timeStamp
    };
    
    var newRequest = new Promise(function(resolve,reject){
        var array = [];
        request.get(flickrApiBaseUrl+flickrMethod+method+flickrText+text+flickrSort+sort+flickrPerPage+perPage+flickrPage+page,function (error, response, data) {
          if (!error && response.statusCode == 200) {
            data = JSON.parse(data);
            //console.log(data.photos.pages);
            storeData(insertObject);
            for (var i=0; i<data.photos.photo.length; i++){
                var title="No Title";
                var description="No Description";
                var photo = data.photos.photo[i];
                var id = photo.id;
                console.log("outside: "+id);
                var secret = photo.secret;
                var farmId = photo.farm;
                var serverId = photo.server;
                var photoUrl = "".concat("https://farm",farmId,".staticflickr.com/",serverId,"/",id,"_",secret,".jpg");
                var photoUrlThumbNail = photoUrl.substring(0,photoUrl.length-4).concat("_t",".jpg");
                getPhotoInfo(id,secret, photoUrl, photoUrlThumbNail, function(photoData, url1, url2){
                    if (photoData.photo.title._content !== ""){
                        title = photoData.photo.title._content;
                    }
                    if (photoData.photo.description._content !== ""){
                        description = photoData.photo.description._content;
                    }
                     var outputObject = {
                        thumbmail: url2,
                        photoUrl : url1,
                        imageTitle: title,
                        imageDescription: description
                    };
                    array.push(outputObject);
                    console.log(url2);
                }).then(function(){
                   setInterval(function(){
                        if (array.length === 10){
                            resolve(array);                
                        }
                    }, 500);
                });
            }
            
            
        }else{
              reject(console.log(error));
          }
        });    
    });
    //console.log(flickrApiBaseUrl+flickrMethod+method+flickrText+text+flickrSort+sort+flickrPerPage+perPage+flickrPage+page);
    newRequest.then(function(array){
        res.send(array);   
        res.end();
    });
    
});



/*
User Story: I can get the image URLs, alt text and page urls for a set of images relating to a given search string.

User Story: I can paginate through the responses by adding a ?offset=2 parameter to the URL.

User Story: I can get a list of the most recently submitted search strings.


*/

app.listen(process.env.PORT, function(){
    console.log("Server listening on: "+ process.env.PORT);
});