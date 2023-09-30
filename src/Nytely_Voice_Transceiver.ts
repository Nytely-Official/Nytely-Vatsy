//Imports
import Port_Audio from "naudiodon";
import chalk from "chalk";
import { Socket } from "socket.io";
import Socket_Client from "socket.io-client";

//Setup the Heart Rate Class
export class Nytely_Voice_Transceiver {
	//
	//Setup the Private Properties
	#Microphone: Port_Audio.IoStreamRead | undefined;
	#Speaker: Port_Audio.IoStreamWrite | undefined;
	#Audio_Device_List: Nytely_Audio_Device_List;
	#Transmitting_Audio: boolean;
	#Receiving_Audio: boolean;

	//Setup the Constructor
	constructor() {
		//
		//Update the Private Properties
		this.#Audio_Device_List = new Nytely_Audio_Device_List();
		this.#Transmitting_Audio = false;
		this.#Receiving_Audio = false;
	}

	//This will set the Microphone based on the Given Microphone's Name
	async Set_Microphone(Microphone_Name: string) {
		//
		//Get the Microphone from the Audio Device List
		const Requested_Microphone = await this.#Audio_Device_List.Get_Microphone(Microphone_Name);

		//Check if the Microphone was not Found
		if (!Requested_Microphone) {
			//
			//Let the User know the Microphone was not Found
			console.log(chalk.red(`Microphone Not Found: "${chalk.white(Microphone_Name)}"`));

			//End the Program
			return process.exit();
		}

		//Let the User Know the Microphone was Found
		console.log(chalk.green(`Microphone Connected: "${chalk.white(Microphone_Name)}"`));

		//Get the Microphone's Audio Stream
		const Microphone_Audio_Stream = Port_Audio.AudioIO({
			inOptions: {
				channelCount: 2,
				sampleFormat: Port_Audio.SampleFormat16Bit,
				sampleRate: Requested_Microphone.defaultSampleRate,
				deviceId: Requested_Microphone.id,
				closeOnError: false,
			},
		});

		//Set the Microphone
		this.#Microphone = Microphone_Audio_Stream;
	}

	//This will set the Speaker based on the Given Speaker's Name
	async Set_Speaker(Speaker_Name: string) {
		//
		//Get the Speaker from the Audio Device List
		const Requested_Speaker = await this.#Audio_Device_List.Get_Speaker(Speaker_Name);

		//Check if the Speaker was not Found
		if (!Requested_Speaker) {
			//
			//Let the User know the Speaker was not Found
			console.log(chalk.red(`Speaker Not Found: "${chalk.white(Speaker_Name)}"`));

			//End the Program
			return process.exit();
		}

		//Let the User Know the Speaker was Found
		console.log(chalk.green(`Speaker Connected: "${chalk.white(Speaker_Name)}"`));

		//Get the Speaker's Audio Stream
		const Speaker_Audio_Stream = Port_Audio.AudioIO({
			outOptions: {
				channelCount: 2,
				sampleFormat: Port_Audio.SampleFormat16Bit,
				sampleRate: Requested_Speaker.defaultSampleRate,
				deviceId: Requested_Speaker.id,
				closeOnError: false,
			},
		});

		//Set the Speaker
		this.#Speaker = Speaker_Audio_Stream;
	}

	//Starts Transmitting Audio to the requested IP
	async Transmit_Audio(Requested_IP: string, Connections_List: Map<string, Socket>) {
		//
		//Check if the Audio is currently being Transmitted
		if (this.#Transmitting_Audio) return console.log(chalk.yellow(`Already Transmitting Audio`));

		//Check if the Microphone is not Valid
		if (!this.#Microphone) return console.log(chalk.yellow(`Microphone not Set`));

		//Show the Audio as Currently Transmitting
		this.#Transmitting_Audio = true;

		//Start the Microphone
		this.#Microphone.start();

		//Listen for Microphone Audio Data
		this.#Microphone.on("data", data => {
			//
			//Get the Connection Socket for the Specified Address
			const Requested_IP_Socket = Connections_List.get(Requested_IP);

			//Check if the Requested IP Socket does not Exist
			if (!Requested_IP_Socket) {
				return console.log(chalk.yellow(`${Requested_IP} Is currently Offline`));
			}

			//Send the Data to the Specified Socket
			Requested_IP_Socket.emit("Audio_Data", data);
		});
	}

	//Starts Receiving Audio from the requested IP
	async Receive_Audio(Requested_IP: string) {
		//
		//Check if the Audio is currently being Received
		if (this.#Receiving_Audio) return console.log(chalk.yellow(`Already Receiving Audio`));

		//Check if the Speaker is not Valid
		if (!this.#Speaker) return console.log(chalk.yellow(`Speaker not Set`));

		//Show the Audio as Currently Receiving
		this.#Receiving_Audio = true;

		//Start the Speaker
		this.#Speaker.start();

		//Connect to the Requested Client
		const Requested_Client = Socket_Client(`http://localhost:3000`).connect();

		//console.log(Requested_Client);

		//Listen for Incoming Audio
		Requested_Client.on("Audio_Data", data => {
			//
			//Check if the Speaker is not Valid
			if (!this.#Speaker) return;

			this.#Speaker.write(data);
		});
	}
}

//Setup the Audio Device List Class
class Nytely_Audio_Device_List {
	//
	//Setup the Private Properties
	#Microphones: Array<Port_Audio.DeviceInfo>;
	#Speakers: Array<Port_Audio.DeviceInfo>;

	//Setup the Constructor
	constructor() {
		//
		//Build the Private Properties
		this.#Microphones = new Array();
		this.#Speakers = new Array();
	}

	//Gets the Requested Microphone
	async Get_Microphone(Microphone_Name: string): Promise<Port_Audio.DeviceInfo | undefined> {
		//
		//Update the Audio Device List
		await this.#Update_Device_List();

		//Find the Requested Microphone
		const Requested_Microphone = this.#Microphones.find(Current_Microphone => {
			//
			//Get the Current Microphone's Name
			const Current_Microphone_Name = Current_Microphone.name.toLowerCase();

			//Get the Requested Microphones Name
			const Requested_Microphone_Name = Microphone_Name.toLowerCase();

			//Check if the Current Microphone's Name is similar to the Requested Microphones Name
			if (Current_Microphone_Name.includes(Requested_Microphone_Name)) return Current_Microphone;
		});

		//Return the Requested Microphone
		return Requested_Microphone;
	}

	//Gets the Requested Speaker
	async Get_Speaker(Microphone_Name: string): Promise<Port_Audio.DeviceInfo | undefined> {
		//
		//Update the Audio Device List
		await this.#Update_Device_List();

		//Find the Requested Speaker
		const Requested_Speaker = this.#Speakers.find(Current_Speaker => {
			//
			//Get the Current Speaker's Name
			const Current_Speaker_Name = Current_Speaker.name.toLowerCase();

			//Get the Requested Speakers Name
			const Requested_Speaker_Name = Microphone_Name.toLowerCase();

			//Check if the Current Speaker's Name is similar to the Requested Speakers Name
			if (Current_Speaker_Name.includes(Requested_Speaker_Name)) return Current_Speaker;
		});

		//Return the Requested Speaker
		return Requested_Speaker;
	}

	//The will update the List of Available Devices
	async #Update_Device_List() {
		//
		//Get the Raw Audio Device List
		const Raw_Audio_Devices = Port_Audio.getDevices();

		//Loop through the Raw Audio Devices
		for (const Raw_Audio_Device of Raw_Audio_Devices) {
			//
			//Check if the Requested Device is a Microphone and add it to the Microphone List
			if (Raw_Audio_Device.maxInputChannels > 0) this.#Microphones.push(Raw_Audio_Device);

			//Check if the Requested Device is a Speaker and add it to the Speaker List
			if (Raw_Audio_Device.maxOutputChannels > 0) this.#Speakers.push(Raw_Audio_Device);
		}
	}
}
