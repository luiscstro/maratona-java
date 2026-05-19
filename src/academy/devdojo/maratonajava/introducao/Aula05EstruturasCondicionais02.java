package academy.devdojo.maratonajava.introducao;

public class Aula05EstruturasCondicionais02 {
    static void main(String[] args) {
        int idade = 27;
        String categoria;
        if (idade < 15){
            categoria = ("Categoria Ifantil");
        } else if (idade >= 15 && idade < 18) {
            categoria = ("Categoria Juvenil");
        } else {
            categoria = ("Categoria Adulto");
        }
        System.out.println(categoria);
        }
    }

    // variaveis locais precisam ser inicializadas, se não, o codigo não funciona