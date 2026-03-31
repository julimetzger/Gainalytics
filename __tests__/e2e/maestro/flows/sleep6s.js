// Busy-wait for 6 seconds to let the ProgressBar fill to a visible level.
var start = Date.now();
while (Date.now() - start < 6000) {}
output.sleptMs = Date.now() - start;
