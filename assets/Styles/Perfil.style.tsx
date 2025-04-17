import { StyleSheet } from "react-native";
import { Colors } from "@/constants/Colors";

export const perfilStyle = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: Colors.light.background,
    flexGrow: 1,
  },
  title: {
    fontSize: 25,
    fontWeight: "800",
    marginBottom: 16,
    color: Colors.light.text,
  },
  label: {
    fontWeight: "600",
    marginTop: 16,
    fontSize: 16,
    color: Colors.light.text,
  },
  info: {
    fontSize: 16,
    color: "#333",
    marginBottom: 8,
  },
  inputWrapper: {
    position: "relative",
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    backgroundColor: "#f9f9f9",
    borderRadius: 15,
    padding: 12,
    paddingRight: 40,
  },
  eyeIcon: {
    position: "absolute",
    right: 12,
    top: 14,
  },
  button: {
    backgroundColor: Colors.light.secundario,
    padding: 14,
    borderRadius: 15,
    alignItems: "center",
    marginTop: 20,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  logoutButton: {
    backgroundColor:'#dc2626',
    padding: 14,
    borderRadius: 15,
    alignItems: "center",
    marginTop: 16,
  },
  logoutText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 17,
  },
});
