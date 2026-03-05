import Text "mo:core/Text";

actor {
  public query ({ caller }) func greet(name : Text) : async Text {
    "Happy Birthday, " # name # "!";
  };
};
