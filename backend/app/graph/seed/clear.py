from app.database import _driver



def clear():

    with _driver.session() as session:

        session.run(
            """
            MATCH (n)
            DETACH DELETE n
            """
        )


    print(
        "Neo4j nettoyé"
    )



if __name__ == "__main__":

    clear()