let APP_ID = "ec000c8b8da34a3daf7af36cbf8cfd99"

let token = null;
let uid = String(Math.floor(Math.random()*10000))

let client;
let channel;

// from the url we are extracting the room parameter
let queryString = window.location.search
let urlParamas = new URLSearchParams(queryString)
let roomId = urlParamas.get('room')

// so like we cannot enter index.html , it redirects us to lobby, we cannot join index.html until we have a roomId
if(!roomId){
    window.location = "lobby.html"
}

let localStream;
let remoteStream;
let peerConnection;

const servers = {
    iceServers:[
        {
            urls:['stun:stun1.1.google.com:19302', 'stun:stun2.1.google.com:19302']
        }
    ]
}

// create  a client,login
// create a channel, join the channel

let constraints = {
    video:{
        width: {min:640,ideal:1920,max:1920},
        height:{min:480,ideal:1080,max:1080},
    },
    audio:true

}

let init = async () =>{
    client = await AgoraRTM.createInstance(APP_ID)
    await client.login({uid,token})

    //roomID , the channel name  was 'main' earlier
    channel = client.createChannel(roomId)
    await channel.join()

    channel.on('MemberJoined',handleUserJoined)

    channel.on('Member Left',handleUserLeft)

    client.on("MessageFromPeer",handleMessageFromPeer)

    localStream = await navigator.mediaDevices.getUserMedia(constraints)
    document.getElementById('user-1').srcObject = localStream
}

let handleUserJoined = async (MemberId) =>{
    console.log('A new member joined the channel: ',MemberId)
    createOffer(MemberId)
}

let handleMessageFromPeer = async (message,MemberId) =>{
    message = JSON.parse(message.text)
    if(message.type === 'offer'){
        createAnswer(MemberId,message.offer)
    }

    if(message.type === 'answer'){
        addAnswer(message.answer)
    }

    if(message.type === 'candidate'){
        if(peerConnection){
            peerConnection.addIceCandidate(message.candidate)
        }
    }
}

let handleUserLeft = async (MemberId) =>{
    document.getElementById('user-2').style.display = 'none'
    document.getElementById('user-1').classList.remove('smallFrame')
}

let createPeerConnection = async (MemberId) =>{
    peerConnection = new RTCPeerConnection(servers)

    remoteStream = new MediaStream()
    document.getElementById('user-2').srcObject = remoteStream
    document.getElementById('user-2').style.display = 'block'

    document.getElementById('user-1').classList.add('smallFrame')

    if(!localStream){
        localStream = await navigator.mediaDevices.getUserMedia({video:true,audio:true})
        document.getElementById('user-1').srcObject = localStream
    }

    localStream.getTracks().forEach((track) =>{
        peerConnection.addTrack(track,localStream)
    })
     
    //listening the tracks
    peerConnection.ontrack = (event)=>{
        event.streams[0].getTracks().forEach((track)=>{
            remoteStream.addTrack(track)
        })
    }
    

    peerConnection.onicecandidate = async (e) =>{
        if(e.candidate){
            // console.log('New Ice candidate:',e.candidate)
            client.sendMessageToPeer({text:JSON.stringify({'type':'candidate','candidate':e.candidate})},MemberId)
            //trickling ice candidates
        }
    }// series of request to the stun server
}

// create a peer connection first
// create an offer ans set it as local desc
// send this offer to the peer
let createOffer = async (MemberId) =>{
    
    await createPeerConnection(MemberId)

    let offer = await peerConnection.createOffer()
    await peerConnection.setLocalDescription(offer) // setLocalDescription will fire onicecandidate function

    // console.log("Offer: ",offer)
    client.sendMessageToPeer({text:JSON.stringify({'type':'offer','offer':offer})},MemberId)
}

// get offer from the peer ,set remote desc as offer 
//   create an answer and it as the local desc
// send this answer to ur peer
let createAnswer = async (MemberId,offer) =>{
    await createPeerConnection(MemberId)

    await peerConnection.setRemoteDescription(offer)

    let answer = await peerConnection.createAnswer()
    await peerConnection.setLocalDescription(answer)

    client.sendMessageToPeer({text:JSON.stringify({'type':'answer','answer':answer})},MemberId)

}

let addAnswer = async (answer) =>{
    if(!peerConnection.currentRemoteDescription){
        peerConnection.setRemoteDescription(answer)
    }
}

let leaveChannel = async()=>{
    await channel.leave()
    await client.logout()
}

let toggleCamera = async ()=>{
    
    let videoTrack = localStream.getTracks().find(track=>track.kind === 'video')

    if(videoTrack.enabled){
             videoTrack.enabled = false
             document.getElementById('camera-btn').style.backgroundColor = 'rgb(255,80,80)'
    }else{
        videoTrack.enabled = true
             document.getElementById('camera-btn').style.backgroundColor = 'rgb(179,102,249,.9)'
    }
}

let toggleMic = async ()=>{
    
    let audioTrack = localStream.getTracks().find(track=>track.kind === 'audio')

    if(audioTrack.enabled){
        audioTrack.enabled = false
             document.getElementById('mic-btn').style.backgroundColor = 'rgb(255,80,80)'
    }else{
        audioTrack.enabled = true
             document.getElementById('mic-btn').style.backgroundColor = 'rgb(179,102,249,.9)'
    }
}


window.addEventListener('beforeunload',leaveChannel)

document.getElementById('camera-btn').addEventListener('click',toggleCamera)
document.getElementById('mic-btn').addEventListener('click',toggleMic)

init()