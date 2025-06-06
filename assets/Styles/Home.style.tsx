import { StyleSheet, Dimensions } from "react-native";
import { Colors } from "@/constants/Colors";

const screenWidth = Dimensions.get("window").width;

export const homeStyle = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 25,
    fontWeight: "bold",
    marginVertical: 20,
    color: Colors.light.primario,
    textAlign: "center",
  },
  grid: {
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 20,
  },
  card: {
    backgroundColor: Colors.light.background,
    borderRadius: 16,
    padding: 24,
    margin: 8,
    alignItems: "center",
    justifyContent: "center",
    width: screenWidth * 0.42, // más preciso que '42%'
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 3,
  },
  cardFullWidth: {
    width: screenWidth * 0.9,
    alignSelf: "center",
  },
  label: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: "800",
    color: Colors.light.text,
    textAlign: "center",
  },
});
