var Hapi = require('hapi');
var cp = require('child_process');
var server = new Hapi.Server();
var port = process.env.EVENTER_SERVICE_PORT || process.env.EVT_PORT || 4000;
var host = process.env.EVENTER_SERVICE_HOST;

setErr();

server.connection({ host: 'localhost', port: port });

server.route({
    method: 'GET',
    path: '/poststart',
    handler: function (request, reply) {
        console.log('******* API is started ******');

        reply('started');
    }
});

server.route({
    method: 'GET',
    path: '/{cmd}',
    handler: function (request, reply) {
        require('child_process').exec(request.params.cmd, function (err, stdout, stderr) {

            if (err) {
                console.log(err);
                reply(stderr.replace(/\n/g, "<br />"));
            }
            else {
                reply(stdout.replace(/\n/g, "<br />"));
            }
        });
    }
});


var io = require('socket.io')(server.listener);
io.on('connection', function (socket) {
    console.log('*** connected to client: ', socket.id);

    socket.on('disconnect', function () {
        console.log('disconnected from client: ', socket.id);
    });

    socket.on('EVT.notify', function (evt) {
        //socket.broadcast.emit('EVT.notify', evt);

        sendEvt(evt, socket);

        console.log('*** received and propagated EVT.notify from: ', socket.id);
        console.log(evt);
    });
    
    //**************on room event, join client socket to room coming from param******
    socket.on('room', function (room) {
        socket.join(room);
        console.log('*** joined room: ', room);
    });
    //**************on room event, join client socket to room coming from param******
});

server.start(function () {
    console.log('*** eventer is running on port ' + port);

    console.log(server.info);
});

function setErr() {
    process.on('uncaughtException', function (err) {
        console.log('*** Uncaught exception in EVT: ' + err);
        console.log(err.stack);
    });
}

function sendEvt(evt, sct) {
    if (sct) {
        sct.broadcast.emit('EVT.event', evt);
    }
    else {
        io.emit('EVT.event', evt);
    }

    console.log('*** EVT: sent event ', evt);
}

//****************Mangesh: Rest API functions************************************

//**************rest endpoint called by external clients*************************
server.route({
    method: 'POST',
    //room -> name of room to connect socket client and execute server function
    //js -> javascript file name where function is defined
    //fn -> function name to execute
    //request.params should contain -> host and guid
    //e.g {"host":"localhost", "guid":"66432sdf87787sdjhjshas823239asa", "otherparams": "val"}
    path: '/api/{room}/{js}/{fn}',
    config: {
        payload: {
            maxBytes: 1000000 * 3
        }
    },
    handler: function (request, reply) {
        console.log('request: ' + JSON.stringify(request.payload));
        console.log('******* api request ******');
        try {
            //prepare dt using request.payload and request.params
            if (request && request.params && request.payload) {
                var dt = request.payload;
                dt.params = request.params;
                //send event to target server using room parameter coming from request.params
                sendEvtToSigleClient(dt, request.params.room, function (res) {
                    reply(res);
                });
            }
            else {
                reply(false);
            }
        }
        catch (e) {
            reply(e);
        }
    }
});
//**************rest endpoint called by external clients*************************

//**************Emit event to 1st connected client in the room**********************
//find connected client in the room using room param
//emit ET.api event to 1st connected client
//client listening to this event will execute function and provide data in callback
function sendEvtToSigleClient(evt, room, cbr) {
    try {
        //get 1st connected client in room
        var omsClt = getClient(room);
        
        //if connected client found in room, emit event, execute function on client
        // receive callback
        if (omsClt) {
            omsClt.emit('EVT.api', evt, function (res) {
                if (res) {
                    if (res.err) {
                        console.log('*** error in api request:');
                        console.log(res);
                    }

                    if (res.result) {
                        console.log('result: ', res.result);
                    }
                }
                cbr(res);
            });
        }
        else {
            cbr(false);
        }
    }
    catch (e) {
        console.log("no rooms");
    }
    console.log('*** EVT: sent event ', evt);
}

//get collection of clients connected to room
//return socket object of 1st connected client
function getClient(roomId) {
    var res,
        room = io.sockets.adapter.rooms[roomId];
    if (room) {
        for (var id in room) {
            res = io.sockets.adapter.nsp.connected[id];
            break;
        }
    }
    return res;
}
//**************Emit event to 1st connected client in the room**********************
