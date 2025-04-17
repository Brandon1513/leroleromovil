// LoginScreen.styles.js
import { StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';


export const loginStyle = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: Colors.light.background
  },
  logo: {
    width: 140,
    height: 140,
    alignSelf: 'center',
    marginBottom: 20
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 32,
    textAlign: 'center',
    color: '#333'
  },
  inputWrapper: {
    position: 'relative',
    marginTop: 12
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 12,
    paddingRight: 40,
    marginBottom: 16
  },
  eyeIcon: {
    position: 'absolute',
    right: 15,
    top: 14
  },
  button: {
    backgroundColor: Colors.light.secundario,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center'
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16
  }
});
