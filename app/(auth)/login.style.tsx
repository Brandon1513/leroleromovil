import { StyleSheet } from "react-native";
import { Colors } from "@/constants/Colors";

export const loginStyle = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: Colors.light.background,
  },
  logo: {
    width: 140,
    height: 140,
    alignSelf: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 28,
    textAlign: "center",
    color: "#333",
  },
  inputWrapper: {
    position: "relative",
    marginTop: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9f9f9",
    borderRadius: 10,
    padding: 12,
    paddingRight: 42,
    marginBottom: 16,
  },
  eyeIcon: {
    position: "absolute",
    right: 14,
    top: 14,
  },
  button: {
    backgroundColor: Colors.light.secundario,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
});
