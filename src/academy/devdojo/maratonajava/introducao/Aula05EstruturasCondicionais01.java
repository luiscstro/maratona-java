package academy.devdojo.maratonajava.introducao;

public class Aula05EstruturasCondicionais01 {
    static void main(String[] args) {
        int idade = 15;
        boolean isAutorizadoABeber = idade >= 18;
        if (isAutorizadoABeber){
            System.out.println("Pode beber");
        }else{
            System.out.println("Não pode beber");
        }

        if(!isAutorizadoABeber){
            System.out.println("Não pode");
        }
        boolean c = false;
        if (c=true){
            System.out.println("Dentro de algo que nunca deve ser feito");
        }
    }
}
