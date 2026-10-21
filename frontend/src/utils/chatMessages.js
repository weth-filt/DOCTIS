let temporarySequence = 0;
export const temporaryChatId = () => `temp-${Date.now()}-${++temporarySequence}`;
export const chatMessageId = message => String(message?._id || message?.id || "");
export const isPendingChatMessage = message => chatMessageId(message).startsWith("temp-");

const shallowEqual = (left, right) => left === right || Boolean(left && right &&
  Object.keys(left).length === Object.keys(right).length &&
  Object.keys(left).every(key => left[key] === right[key]));

function updatedMessage(previous, incoming) {
  if (!previous) return incoming;
  const attachment = incoming.attachment || previous.attachment;
  const next = {
    ...previous, ...incoming,
    attachment: shallowEqual(previous.attachment, attachment) ? previous.attachment : attachment,
    read: Boolean(previous.read || incoming.read),
    _clientKey: previous._clientKey || incoming._clientKey || chatMessageId(previous),
  };
  return shallowEqual(previous, next) ? previous : next;
}

// Doctor chat is append-only: a GET is a snapshot, not an instruction to delete
// locally pending or already acknowledged messages absent from an older read.
export function mergeChatMessages(previous, incoming) {
  const byId = new Map(previous.map(message => [chatMessageId(message), message]));
  incoming.forEach(message => {
    const id = chatMessageId(message);
    if (id) byId.set(id, updatedMessage(byId.get(id), message));
  });
  const merged = [...byId.values()].sort((left, right) =>
    (Date.parse(left.createdAt) || 0) - (Date.parse(right.createdAt) || 0));
  return merged.length === previous.length && merged.every((message, index) => message === previous[index]) ? previous : merged;
}

export function confirmChatMessage(previous, temporaryId, saved) {
  const savedId = chatMessageId(saved);
  if (!savedId || isPendingChatMessage(saved)) throw new Error("Invalid message acknowledgement");
  const pending = previous.find(message => chatMessageId(message) === temporaryId);
  const known = previous.find(message => chatMessageId(message) === savedId);
  const confirmed = { ...updatedMessage(known, {
    ...saved,
    attachment: saved.attachment || pending?.attachment || known?.attachment,
  }), _clientKey: pending?._clientKey || known?._clientKey || temporaryId };
  return mergeChatMessages(previous.filter(message => ![temporaryId, savedId].includes(chatMessageId(message))), [confirmed]);
}
