import type { PlaceType } from "./types";

/** Sub-rating categories per place type: [label, underlying review-bank aspect keys]. */
export const SUB_RATINGS: Record<PlaceType, [string, string[]][]> = {
  hotel: [
    ["Location", ["location"]],
    ["Cleanliness", ["cleanliness"]],
    ["Service", ["staff", "checkin"]],
    ["Value", ["value"]],
    ["Rooms", ["room"]],
    ["Sleep quality", ["bed", "noise"]],
  ],
  restaurant: [
    ["Food", ["food"]],
    ["Service", ["service"]],
    ["Value", ["value"]],
    ["Atmosphere", ["ambience"]],
  ],
  attraction: [
    ["Experience", ["views", "history", "photos"]],
    ["Crowds", ["crowds", "queue"]],
    ["Value", ["value"]],
    ["Facilities", ["facilities", "accessibility"]],
  ],
  experience: [
    ["Guide", ["guide"]],
    ["Organization", ["organization", "meetingPoint"]],
    ["Value", ["value"]],
    ["Pace", ["pace", "groupSize"]],
  ],
};
