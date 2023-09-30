//External Imports
import Express from "express";
import Socket from "socket.io";
import HTTP from "http";

//Internal Imports
import { Nytely_Voice_Transceiver } from "./Nytely_Voice_Transceiver";

//Setup natpmp (Port Mapper)
const natpmp = require("nat-pmp");

//Setup the Port Mapper Client
const Port_Mapper_Client = natpmp.connect("192.168.1.1");

//Map the Required Ports
Port_Mapper_Client.portMapping({ private: 3000, public: 3000, ttl: 60 });

//Setup the Connections List
const Connections_List: Map<string, Socket.Socket> = new Map();

//Setup Express
const App = Express();
const Server = HTTP.createServer(App);

//Setup Body Parser
App.use(Express.json());

//Setup the Socket Server
const Socket_Server = new Socket.Server(Server);

//Listen for Connections to the Socket Server
Socket_Server.on("connection", Socket_Connection_Handler);

//Start the Express Server.
Server.listen(3000, () => {
	//
	//Log Successful Server Start
	console.log(`Started Web Server on 3000`);
});

//Setup the Socket Connection Handler
function Socket_Connection_Handler(Connection: Socket.Socket) {
	//
	//Get the Clients Address
	const Client_Address = Connection.handshake.address;

	//Add the Connection to the Connections List
	Connections_List.set(Client_Address, Connection);

	//Listen for Socket Disconnect Event
	Connection.on("disconnect", () => Socket_Disconnect_Handler(Connection));

	//Listen for Any Other Connection Events
	Connection.onAny(Socket_Client_Event_Handler);
}

//Setup the Socket Disconnect Handler
function Socket_Disconnect_Handler(Connection: Socket.Socket) {
	//
	//Remove the Connection from the Connections List
	Connections_List.delete(Connection.id);
}

//Setup the TTS Page
App.get("/", (req, res) => {
	res.sendFile(`${process.cwd()}/public/index.html`);
});

//Handle Events from Socket Clients
function Socket_Client_Event_Handler(Listener: string, ...Arguments: [any]) {
	//
}

//Run the Main Function
Main();

//The Main Running Function
async function Main() {
	//
	//Setup the Voice Transceiver
	const Voice_Transceiver = new Nytely_Voice_Transceiver();

	//Set the Voice Transceiver's Microphone
	await Voice_Transceiver.Set_Microphone("Filtered Microphone");

	//Set the Voice Transceiver's Speaker
	await Voice_Transceiver.Set_Speaker("Logitech Headset");

	//Start Transmitting Audio
	await Voice_Transceiver.Transmit_Audio("::1", Connections_List);

	//Start Receiving Audio
	await Voice_Transceiver.Receive_Audio("::1");
}
