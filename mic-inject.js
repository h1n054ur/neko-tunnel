(function() {
  'use strict';

  let peerConnection = null;
  let micStream = null;
  let micSender = null;
  let micActive = false;

  // Intercept RTCPeerConnection to grab the instance neko creates
  const OriginalRTC = window.RTCPeerConnection;
  window.RTCPeerConnection = function(...args) {
    const pc = new OriginalRTC(...args);
    peerConnection = pc;
    console.log('[mic-inject] Captured RTCPeerConnection');
    return pc;
  };
  window.RTCPeerConnection.prototype = OriginalRTC.prototype;
  Object.keys(OriginalRTC).forEach(k => { window.RTCPeerConnection[k] = OriginalRTC[k]; });

  function findControlsUl() {
    // The toolbar is a <ul> containing a <li> with a .volume div inside
    const volumeDiv = document.querySelector('.volume');
    if (volumeDiv) {
      const ul = volumeDiv.closest('ul');
      if (ul) return ul;
    }
    // Fallback: find any ul that contains fa-play-circle or fa-pause-circle
    const playBtn = document.querySelector('.fa-play-circle, .fa-pause-circle');
    if (playBtn) {
      const ul = playBtn.closest('ul');
      if (ul) return ul;
    }
    return null;
  }

  function addMicButton() {
    const controls = findControlsUl();
    if (!controls) {
      setTimeout(addMicButton, 500);
      return;
    }

    // Don't add twice
    if (document.getElementById('mic-inject-btn')) return;

    const li = document.createElement('li');
    li.id = 'mic-inject-btn';
    li.style.cursor = 'pointer';
    li.innerHTML = '<i class="fas fa-microphone-slash" style="padding: 0 5px; color: rgba(255,255,255,0.4); font-size: 24px;"></i>';
    li.title = 'Toggle Microphone';

    const icon = li.querySelector('i');

    li.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();

      if (micActive) {
        // Stop mic
        if (micSender && peerConnection) {
          peerConnection.removeTrack(micSender);
          micSender = null;
        }
        if (micStream) {
          micStream.getTracks().forEach(t => t.stop());
          micStream = null;
        }
        micActive = false;
        icon.className = 'fas fa-microphone-slash';
        icon.style.color = 'rgba(255,255,255,0.4)';
        console.log('[mic-inject] Microphone disabled');
      } else {
        // Start mic
        if (!peerConnection) {
          console.warn('[mic-inject] No peer connection yet, wait for video to connect first');
          alert('Wait for the video stream to connect first, then try again.');
          return;
        }

        try {
          micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const audioTrack = micStream.getAudioTracks()[0];
          micSender = peerConnection.addTrack(audioTrack, micStream);
          micActive = true;
          icon.className = 'fas fa-microphone';
          icon.style.color = '#19bd9c';
          console.log('[mic-inject] Microphone enabled, track:', audioTrack.label);
        } catch (err) {
          console.error('[mic-inject] Failed to get microphone:', err);
          alert('Could not access microphone: ' + err.message);
        }
      }
    });

    // Insert before the volume control
    const volumeItem = controls.querySelector('.volume')?.closest('li');
    if (volumeItem) {
      controls.insertBefore(li, volumeItem);
    } else {
      controls.appendChild(li);
    }
    console.log('[mic-inject] Mic button added to toolbar');
  }

  // Keep trying until controls appear (user needs to log in first)
  function poll() {
    if (!document.getElementById('mic-inject-btn')) {
      addMicButton();
    }
    setTimeout(poll, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(poll, 1000));
  } else {
    setTimeout(poll, 1000);
  }
})();
